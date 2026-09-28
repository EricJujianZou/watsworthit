// Inline SVG symbol sprite for the overlay, ported from the approved design.
// A few symbols the old page used (dashboard grid, graduation cap, calendar,
// settings gear) are dropped because WatsWorthIt's rail only ever shows
// three links plus the brand mark. Home and cycle are new.

export const ICON_SPRITE = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></symbol>
<symbol id="i-sliders" viewBox="0 0 24 24"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></symbol>
<symbol id="i-saved" viewBox="0 0 24 24"><path d="M4 6h16M4 12h10M4 18h7"/><path d="m16 15 2 2 4-4"/></symbol>
<symbol id="i-mark" viewBox="0 0 24 24"><path d="M6 4h12v17l-6-4-6 4z"/></symbol>
<symbol id="i-ext" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></symbol>
<symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></symbol>
<symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></symbol>
<symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></symbol>
<symbol id="i-moon" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></symbol>
<symbol id="i-down" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>
<symbol id="i-up" viewBox="0 0 24 24"><path d="m6 15 6-6 6 6"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></symbol>
<symbol id="i-sort" viewBox="0 0 24 24"><path d="M8 5v14M4 15l4 4 4-4M16 19V5M12 9l4-4 4 4"/></symbol>
<symbol id="i-sortd" viewBox="0 0 24 24"><path d="M12 5v14M6 13l6 6 6-6"/></symbol>
<symbol id="i-sortu" viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></symbol>
<symbol id="i-case" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18"/></symbol>
<symbol id="i-home" viewBox="0 0 24 24"><path d="m4 11 8-7 8 7"/><path d="M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9"/></symbol>
<symbol id="i-cycle" viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 8-8c2.6 0 4.9 1.2 6.4 3.1"/><path d="M20 12a8 8 0 0 1-8 8c-2.6 0-4.9-1.2-6.4-3.1"/><path d="M18.4 3.1v4h-4M5.6 20.9v-4h4"/></symbol>
<symbol id="i-doc" viewBox="0 0 24 24"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/></symbol>
<symbol id="i-folio" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="m21 16-5-5-8 8"/></symbol>
<symbol id="i-send" viewBox="0 0 24 24"><path d="M4 12 20 4l-6 16-3-7z"/></symbol>
</defs></svg>`;

/** <svg class="..."><use href="#i-name"/></svg> */
export function icon(name, cls = 'i') {
  return `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
}
