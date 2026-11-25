/* Kōji & Crumb — interactions
   Mobile nav, menu tabs, live opening status, workshop booking and
   reveal-on-scroll. No dependencies. */

(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------- header + nav */

  const header = document.querySelector("[data-header]");
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");

  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  function setNav(open) {
    toggle.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("nav-open", open);
  }

  toggle.addEventListener("click", () => {
    setNav(toggle.getAttribute("aria-expanded") !== "true");
  });

  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) setNav(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("nav-open")) {
      setNav(false);
      toggle.focus();
    }
  });

  /* ---------------------------------------------------------- menu tabs */

  document.querySelectorAll("[data-tabs]").forEach((container) => {
    const tabs = [...container.querySelectorAll('[role="tab"]')];
    const panels = tabs.map((tab) => document.getElementById(tab.getAttribute("aria-controls")));

    function select(index, { focus = false } = {}) {
      tabs.forEach((tab, i) => {
        const selected = i === index;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
        panels[i].hidden = !selected;
      });

      const panel = panels[index];
      if (!reduceMotion) {
        panel.classList.remove("is-entering");
        void panel.offsetWidth; // restart the entrance animation
        panel.classList.add("is-entering");
      }
      if (focus) tabs[index].focus();
    }

    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => select(index));
      tab.addEventListener("keydown", (event) => {
        const last = tabs.length - 1;
        const moves = {
          ArrowRight: index === last ? 0 : index + 1,
          ArrowLeft: index === 0 ? last : index - 1,
          Home: 0,
          End: last,
        };
        if (event.key in moves) {
          event.preventDefault();
          select(moves[event.key], { focus: true });
        }
      });
    });

    select(0);
  });

  /* ------------------------------------------------- live opening status */

  const hourRows = [...document.querySelectorAll("[data-hours] tr[data-day]")];
  const pill = document.querySelector("[data-status-pill]");
  const pillText = document.querySelector("[data-status-short]");
  const longStatus = document.querySelector("[data-status-long]");
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const toMinutes = (hhmm) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const pretty = (hhmm) => {
    const [h, m] = hhmm.split(":");
    return `${Number(h)}:${m}`;
  };
  const rowFor = (day) => hourRows.find((row) => Number(row.dataset.day) === day);

  function getStatus(now) {
    const day = now.getDay();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const today = rowFor(day);

    if (today && today.dataset.open) {
      const opens = toMinutes(today.dataset.open);
      const closes = toMinutes(today.dataset.close);
      if (minutes >= opens && minutes < closes) {
        const closingSoon = closes - minutes <= 45;
        return {
          open: true,
          short: closingSoon ? `Closing soon · ${pretty(today.dataset.close)}` : "Open now",
          long: closingSoon
            ? `Open, but closing soon at ${pretty(today.dataset.close)}`
            : `Open now until ${pretty(today.dataset.close)}`,
        };
      }
      if (minutes < opens) {
        return {
          open: false,
          short: `Opens ${pretty(today.dataset.open)}`,
          long: `Closed right now. Opens today at ${pretty(today.dataset.open)}`,
        };
      }
    }

    for (let offset = 1; offset <= 7; offset += 1) {
      const nextDay = (day + offset) % 7;
      const row = rowFor(nextDay);
      if (row && row.dataset.open) {
        const when = offset === 1 ? "tomorrow" : DAY_NAMES[nextDay];
        return {
          open: false,
          short: `Opens ${offset === 1 ? "tomorrow" : DAY_NAMES[nextDay].slice(0, 3)} ${pretty(row.dataset.open)}`,
          long: `Closed right now. Opens ${when} at ${pretty(row.dataset.open)}`,
        };
      }
    }
    return { open: false, short: "Closed", long: "Closed" };
  }

  function renderStatus() {
    const now = new Date();
    const status = getStatus(now);
    pill.classList.toggle("is-open", status.open);
    pillText.textContent = status.short;
    longStatus.textContent = status.long;
    longStatus.classList.toggle("is-open", status.open);

    hourRows.forEach((row) => {
      const isToday = Number(row.dataset.day) === now.getDay();
      row.classList.toggle("is-today", isToday);
    });
  }

  renderStatus();
  setInterval(renderStatus, 60 * 1000);

  /* --------------------------------------------------- workshop booking */

  const form = document.getElementById("booking");
  const success = form.querySelector("[data-success]");
  const fields = {
    name: form.elements.name,
    email: form.elements.email,
    workshop: form.elements.workshop,
    seats: form.elements.seats,
  };
  const cards = new Map(
    [...document.querySelectorAll("[data-workshop]")].map((card) => [card.dataset.workshop, card])
  );
  let submitted = false;

  const seatsLeft = (key) => {
    const card = cards.get(key);
    return card ? Number(card.dataset.seats) : null;
  };

  const rules = {
    name: (value) => value.trim().length >= 2 || "Please tell us your name.",
    email: (value) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()) || "That email doesn’t look quite right.",
    workshop: (value) => Boolean(value) || "Pick a workshop first.",
    seats: (value) => {
      const count = Number(value);
      const left = seatsLeft(fields.workshop.value);
      if (!Number.isInteger(count) || count < 1) return "At least one seat, please.";
      if (count > 4) return "Four seats per booking, max.";
      if (left !== null && count > left) return `Only ${left} seat${left === 1 ? "" : "s"} left on this one.`;
      return true;
    },
  };

  function validate(name) {
    const input = fields[name];
    const result = rules[name](input.value);
    const message = result === true ? "" : result;
    const error = document.getElementById(`${input.id}-error`);
    input.setAttribute("aria-invalid", message ? "true" : "false");
    error.textContent = message;
    return !message;
  }

  function highlightCard(key) {
    cards.forEach((card, cardKey) => card.classList.toggle("is-selected", cardKey === key));
  }

  Object.keys(fields).forEach((name) => {
    fields[name].addEventListener(name === "workshop" ? "change" : "input", () => {
      if (submitted) validate(name);
      if (name === "workshop") {
        highlightCard(fields.workshop.value);
        if (submitted) validate("seats");
      }
    });
    fields[name].addEventListener("blur", () => {
      if (submitted || fields[name].value) validate(name);
    });
  });

  document.querySelectorAll("[data-book]").forEach((button) => {
    button.addEventListener("click", () => {
      fields.workshop.value = button.dataset.book;
      highlightCard(button.dataset.book);
      if (submitted) validate("workshop");
      form.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      window.setTimeout(() => fields.name.focus({ preventScroll: true }), reduceMotion ? 0 : 450);
    });
  });

  function updateCard(key) {
    const card = cards.get(key);
    const left = Number(card.dataset.seats);
    const label = card.querySelector("[data-seats-label]");
    const button = card.querySelector("[data-book]");
    const option = fields.workshop.querySelector(`option[value="${key}"]`);

    label.textContent = left > 0 ? `${left} seat${left === 1 ? "" : "s"} left` : "Fully booked";
    label.classList.toggle("is-low", left > 0 && left <= 2);
    if (left === 0) {
      button.disabled = true;
      button.textContent = "Full";
      option.disabled = true;
      option.textContent = `${option.textContent} (full)`;
    }
  }

  cards.forEach((_, key) => updateCard(key));

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitted = true;

    const results = Object.keys(fields).map((name) => [name, validate(name)]);
    const firstInvalid = results.find(([, ok]) => !ok);
    if (firstInvalid) {
      fields[firstInvalid[0]].focus();
      return;
    }

    const key = fields.workshop.value;
    const seats = Number(fields.seats.value);
    const card = cards.get(key);
    const title = card.querySelector(".workshop-title").firstChild.textContent.trim();
    const name = fields.name.value.trim().split(/\s+/)[0];

    card.dataset.seats = String(Number(card.dataset.seats) - seats);
    updateCard(key);

    success.innerHTML = "";
    const heading = document.createElement("strong");
    heading.textContent = `Lovely, ${name}. ${seats === 1 ? "One seat" : `${seats} seats`} held for “${title}”.`;
    const body = document.createElement("span");
    body.textContent = `We’d normally email ${fields.email.value.trim()} a confirmation, but this is a concept site, so nothing was sent.`;
    success.append(heading, body);

    form.reset();
    fields.seats.value = "1";
    submitted = false;
    Object.values(fields).forEach((input) => input.setAttribute("aria-invalid", "false"));
    highlightCard(null);
  });

  /* ------------------------------------------------- reveal + counters */

  const revealTargets = document.querySelectorAll("[data-reveal], [data-timeline]");

  function countUp(el) {
    const target = Number(el.dataset.count);
    if (reduceMotion || target === 0) return;
    const start = performance.now();
    const duration = 1200;
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      el.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(tick);
    };
    el.textContent = "0";
    requestAnimationFrame(tick);
  }

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          entry.target.querySelectorAll("[data-count]").forEach(countUp);
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    revealTargets.forEach((el) => observer.observe(el));
  } else {
    revealTargets.forEach((el) => el.classList.add("is-visible"));
  }

  /* ------------------------------------------------------------- misc */

  const year = document.querySelector("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());
})();
