export type Labels = {
  title: string;
  search: string;
  noMatch: string;
  zoomIn: string;
  zoomOut: string;
  fit: string;
  reset: string;
  close: string;
  parents: string;
  spouse: string;
  and: string;
  none: string;
  loading: string;
  loadError: string;
  empty: string;
};

/** Public interface: Hindi (Devanagari) only. */
export const hi: Labels = {
  title: "वंश वृक्ष",
  search: "नाम खोजें",
  noMatch: "कोई नाम नहीं मिला",
  zoomIn: "बड़ा करें",
  zoomOut: "छोटा करें",
  fit: "पूरा वृक्ष",
  reset: "मूल स्थिति",
  close: "बंद करें",
  parents: "माता-पिता",
  spouse: "जीवनसाथी",
  and: "और",
  none: "—",
  loading: "वृक्ष खुल रहा है…",
  loadError: "वृक्ष नहीं खुल सका। कृपया कुछ देर बाद फिर प्रयास करें।",
  empty: "अभी वृक्ष में कोई नाम नहीं जोड़ा गया है।",
};

/** Admin interface: English. */
export const en: Labels = {
  title: "Family tree",
  search: "Search a name",
  noMatch: "No match",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  fit: "Fit to screen",
  reset: "Reset",
  close: "Close",
  parents: "Parents",
  spouse: "Spouse",
  and: "and",
  none: "—",
  loading: "Loading…",
  loadError: "Could not load the tree.",
  empty: "No one has been added yet. Use the panel on the right to add the first person.",
};
