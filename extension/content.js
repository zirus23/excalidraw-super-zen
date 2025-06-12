const UI_SELECTORS = [
  "[class*='App-menu']",
  "[class*='z-sidebar']",
  "[class*='App-top-bar']",
  "[class*='App-bottom-bar']",
  "[class*='App-toolbar']",
  "[class*='App-toolbar-container']",
  "[class*='Island']",
  "[class*='FixedSideContainer']",
  "[class*='Stack_vertical']",
  "[class*='Stack_horizontal']"
];

const STORAGE_KEY = "excalidraw_ui_hidden";
let uiHidden = false;
let knownElements = new Set();

// Inject CSS once
function injectZenStyles() {
  if (document.getElementById("super-zen-style")) return;

  const style = document.createElement("style");
  style.id = "super-zen-style";
  style.textContent = `
    .super-zen-hide {
      display: none !important;
    }
    .super-zen-shortcuts .HelpDialog__island-title {
      color: #f7c873 !important;
    }
  `;
  document.head.appendChild(style);
}

function isInColorPicker(el) {
  let island = el.closest('.Island');
  if (!island) return false;
  return !!island.querySelector('.color-picker-content');
}

// Reapply hiding to any matching elements not already hidden
function reapplyHiding() {
  if (!uiHidden) return;

  UI_SELECTORS.forEach(selector => {
    const matches = document.querySelectorAll(selector);
    matches.forEach(el => {
      // Don't hide if inside HelpDialog
      if (el.closest('.HelpDialog')) return;
      if (isInColorPicker(el)) return;
      if (!knownElements.has(el)) {
        el.classList.add("super-zen-hide");
        knownElements.add(el);
      }
    });
  });
}

// Remove hiding from all matching elements
function removeAllZenHiding() {
  UI_SELECTORS.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      // Don't unhide if inside HelpDialog (not needed, but safe)
      if (el.closest('.HelpDialog')) return;
      if (isInColorPicker(el)) return;
      el.classList.remove("super-zen-hide");
    });
  });
  knownElements.clear();
}

// Save state
function saveState(hidden) {
  chrome.storage.sync.set({ [STORAGE_KEY]: hidden });
}

// Sync changes from other tabs
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes[STORAGE_KEY]) {
    const shouldHide = changes[STORAGE_KEY].newValue;
    if (shouldHide !== uiHidden) {
      uiHidden = shouldHide;
      if (uiHidden) {
        reapplyHiding();
      } else {
        removeAllZenHiding();
      }
    }
  }
});

// On tab activation, re-sync state
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    chrome.storage.sync.get([STORAGE_KEY], (result) => {
      const shouldHide = !!result[STORAGE_KEY];
      if (shouldHide !== uiHidden) {
        uiHidden = shouldHide;
        if (uiHidden) {
          reapplyHiding();
        } else {
          removeAllZenHiding();
        }
      }
    });
  }
});

// Keyboard shortcut
window.addEventListener("keydown", (e) => {
  const isMac = navigator.platform.toUpperCase().includes("MAC");

  const isToggle =
    (isMac && e.metaKey && e.shiftKey && e.code === "KeyB") ||
    (!isMac && e.ctrlKey && e.shiftKey && e.code === "KeyB");

  if (isToggle) {
    e.preventDefault();
    uiHidden = !uiHidden;

    if (uiHidden) {
      reapplyHiding();
    } else {
      removeAllZenHiding();
    }

    saveState(uiHidden);
  }
});

// On load: restore state and start the loop
chrome.storage.sync.get([STORAGE_KEY], (result) => {
  uiHidden = !!result[STORAGE_KEY];
  injectZenStyles();

  // Tick loop that collects and hides new UI matches
  setInterval(() => {
    if (uiHidden) reapplyHiding();
  }, 300);
});


// --- SUPER ZEN SHORTCUTS INJECTION ---

const superZenShortcuts = [
  { key: "Shift + / or ?", desc: "Help/Cheatsheet" },
  { key: "CMD + Shift + B", desc: "Super Zen (UI Toggle)" },
  { key: "T", desc: "Text" },
  { key: "Esc", desc: "Deselect (Mouse tool)" },
  { key: "R", desc: "Rectangle" },
  { key: "5", desc: "Arrow" },
  { key: "6", desc: "Line" },
  { key: "S -> B", desc: "Color Red" },
  { key: "CMD + Shift + < / >", desc: "Decrease/Increase Text Size" },
];

// Safe DOM-based key renderer
function renderShortcutKeysSafe(key, container) {
  // Split on 'or' for alternatives
  const alternatives = key.split(/\s+or\s+/i);
  alternatives.forEach((alt, altIdx) => {
    // Split on '->' for sequences
    const sequences = alt.split('->').map(s => s.trim());
    sequences.forEach((combo, seqIdx) => {
      // Split on '+' for combos
      const keys = combo.split('+').map(k => k.trim());
      keys.forEach((k, kIdx) => {
        // If key is a separator (e.g. " < / > "), split and render as kbd / kbd
        if (/^.+\s\/\s.+$/.test(k)) {
          // e.g. "< / >"
          const [left, right] = k.split(/\s\/\s/);
          const kbdLeft = document.createElement("kbd");
          kbdLeft.className = "HelpDialog__key";
          kbdLeft.textContent = left;
          container.appendChild(kbdLeft);

          container.appendChild(document.createTextNode(" / "));

          const kbdRight = document.createElement("kbd");
          kbdRight.className = "HelpDialog__key";
          kbdRight.textContent = right;
          container.appendChild(kbdRight);
        } else {
          const kbd = document.createElement("kbd");
          kbd.className = "HelpDialog__key";
          kbd.textContent = k;
          container.appendChild(kbd);
        }
        if (kIdx < keys.length - 1) {
          container.appendChild(document.createTextNode(" + "));
        }
      });
      if (seqIdx < sequences.length - 1) {
        container.appendChild(document.createTextNode(" → "));
      }
    });
    if (altIdx < alternatives.length - 1) {
      container.appendChild(document.createTextNode(" or "));
    }
  });
}

function injectSuperZenShortcuts() {
  const dialog = document.querySelector(".Island .Dialog__content");
  if (!dialog) return;

  // Prevent double-injection
  if (dialog.querySelector(".super-zen-shortcuts")) return;

  // Find the Keyboard Shortcuts heading and container
  const h3 = dialog.querySelector("h3");
  const islandsContainer = dialog.querySelector(
    ".HelpDialog__islands-container"
  );
  if (!h3 || !islandsContainer) return;

  // Build the Super Zen shortcuts section
  const section = document.createElement("div");
  section.className = "HelpDialog__island super-zen-shortcuts";
  section.style.marginBottom = "24px";
  section.style.maxWidth = "480px";

  // Title
  const title = document.createElement("h3");
  title.className = "HelpDialog__island-title";
  title.style.color = "#f7c873";
  title.style.fontSize = "1.5em";
  title.style.fontWeight = "bold";
  title.style.marginBottom = "16px";
  title.textContent = "Essential Shortcuts";
  section.appendChild(title);

  // Description
  const desc = document.createElement("p");
  desc.style.marginBottom = "8px";
  desc.textContent =
    "Most common shortcuts to know to avoid using the GUI most of the time.";
  section.appendChild(desc);

  // Attribution
  const attribution = document.createElement("div");
  attribution.style.fontSize = "0.95em";
  attribution.style.color = "#888";
  attribution.style.marginBottom = "4px";
  attribution.textContent =
    "Recommended by Swarnim Kalden, creator of Super Zen.";
  section.appendChild(attribution);

  // Shortcuts list
  const content = document.createElement("div");
  content.className = "HelpDialog__island-content";

  superZenShortcuts.forEach((s) => {
    const shortcutDiv = document.createElement("div");
    shortcutDiv.className = "HelpDialog__shortcut";

    const descDiv = document.createElement("div");
    descDiv.textContent = s.desc;
    shortcutDiv.appendChild(descDiv);

    const keyContainer = document.createElement("div");
    keyContainer.className = "HelpDialog__key-container";
    renderShortcutKeysSafe(s.key, keyContainer);
    shortcutDiv.appendChild(keyContainer);

    content.appendChild(shortcutDiv);
  });

  section.appendChild(content);

  // Change "Keyboard shortcuts" to "All Keyboard Shortcuts"
  if (h3.textContent.trim() === "Keyboard shortcuts") {
    h3.textContent = "All Keyboard Shortcuts";
  }

  // Move the h3 and islandsContainer after the recommended section
  dialog.insertBefore(section, h3);
  dialog.insertBefore(h3, islandsContainer);
}

// Observe for the help dialog opening
const superZenObserver = new MutationObserver(() => {
  injectSuperZenShortcuts();
});

// Start observing the body for added nodes (help dialog is dynamically added)
superZenObserver.observe(document.body, { childList: true, subtree: true });
