import { create } from 'zustand';

export interface EditorElement {
  id: string;
  type: 'Text' | 'Image' | 'Rect' | 'Circle' | 'Line' | 'Star' | 'Arrow' | 'RegularPolygon' | 'Group';
  attrs: Record<string, unknown>;
  visible: boolean;
  locked: boolean;
  name: string;
}

export interface EditorSlide {
  id: string;
  position: number;
  elements: EditorElement[];
  backgroundColor: string;
}

interface HistoryEntry {
  slides: EditorSlide[];
  activeSlideIndex: number;
}

interface EditorState {
  carouselId: string | null;
  slides: EditorSlide[];
  activeSlideIndex: number;
  selectedElementId: string | null;
  zoom: number;
  isSaving: boolean;
  saveStatus: 'saved' | 'saving' | 'unsaved';
  // History
  history: HistoryEntry[];
  historyIndex: number;
  maxHistory: number;

  // Actions
  setCarouselId: (id: string) => void;
  setSlides: (slides: EditorSlide[]) => void;
  setActiveSlide: (index: number) => void;
  selectElement: (id: string | null) => void;
  setZoom: (zoom: number) => void;
  setSaving: (saving: boolean) => void;
  setSaveStatus: (status: 'saved' | 'saving' | 'unsaved') => void;

  // Element operations
  addElement: (element: EditorElement) => void;
  addElementToBack: (element: EditorElement) => void;
  updateElement: (id: string, attrs: Record<string, unknown>) => void;
  removeElement: (id: string) => void;
  reorderElements: (fromIndex: number, toIndex: number) => void;
  toggleElementVisibility: (id: string) => void;
  toggleElementLock: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;

  // Slide operations
  addSlide: (slide?: Partial<EditorSlide>) => void;
  removeSlide: (index: number) => void;
  duplicateSlide: (index: number) => void;
  reorderSlides: (fromIndex: number, toIndex: number) => void;
  updateSlideBackground: (color: string) => void;
  replaceSlideWithImage: (imageSrc: string) => void;

  // History
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export function generateElementId(): string {
  return `el_${crypto.randomUUID()}`;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  carouselId: null,
  slides: [],
  activeSlideIndex: 0,
  selectedElementId: null,
  zoom: 0.5,
  isSaving: false,
  saveStatus: 'saved',
  history: [],
  historyIndex: -1,
  maxHistory: 50,

  setCarouselId: (id) => set({ carouselId: id }),
  setSlides: (slides) => set({ slides, activeSlideIndex: 0, selectedElementId: null }),
  setActiveSlide: (index) => set({ activeSlideIndex: index, selectedElementId: null }),
  selectElement: (id) => set({ selectedElementId: id }),
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(2, zoom)) }),
  setSaving: (saving) => set({ isSaving: saving }),
  setSaveStatus: (status) => set({ saveStatus: status }),

  addElement: (element) => {
    const state = get();
    state.pushHistory();
    const slides = [...state.slides];
    const slide = slides[state.activeSlideIndex];
    if (!slide) return;
    slides[state.activeSlideIndex] = {
      ...slide,
      elements: [...slide.elements, element],
    };
    set({ slides, selectedElementId: element.id, saveStatus: 'unsaved' });
  },

  addElementToBack: (element) => {
    const state = get();
    const slide = state.slides[state.activeSlideIndex];
    if (!slide) return;
    const entry: HistoryEntry = {
      slides: JSON.parse(JSON.stringify(state.slides)),
      activeSlideIndex: state.activeSlideIndex,
    };
    const history = state.history.slice(0, state.historyIndex + 1);
    history.push(entry);
    if (history.length > state.maxHistory) history.shift();
    const newSlides = [...state.slides];
    newSlides[state.activeSlideIndex] = {
      ...slide,
      elements: [element, ...slide.elements],
    };
    set({ slides: newSlides, history, historyIndex: history.length - 1, saveStatus: 'unsaved' });
  },

  updateElement: (id, attrs) => {
    const state = get();
    state.pushHistory();
    const slides = state.slides.map((slide) => ({
      ...slide,
      elements: slide.elements.map((el) =>
        el.id === id ? { ...el, attrs: { ...el.attrs, ...attrs } } : el
      ),
    }));
    set({ slides, saveStatus: 'unsaved' });
  },

  removeElement: (id) => {
    const state = get();
    state.pushHistory();
    const slides = state.slides.map((slide) => ({
      ...slide,
      elements: slide.elements.filter((el) => el.id !== id),
    }));
    set({ slides, selectedElementId: null, saveStatus: 'unsaved' });
  },

  reorderElements: (fromIndex, toIndex) => {
    const state = get();
    state.pushHistory();
    const slide = state.slides[state.activeSlideIndex];
    if (!slide) return;
    const elements = [...slide.elements];
    const [removed] = elements.splice(fromIndex, 1);
    if (removed) elements.splice(toIndex, 0, removed);
    const slides = [...state.slides];
    slides[state.activeSlideIndex] = { ...slide, elements };
    set({ slides, saveStatus: 'unsaved' });
  },

  toggleElementVisibility: (id) => {
    const slides = get().slides.map((slide) => ({
      ...slide,
      elements: slide.elements.map((el) =>
        el.id === id ? { ...el, visible: !el.visible } : el
      ),
    }));
    set({ slides });
  },

  toggleElementLock: (id) => {
    const slides = get().slides.map((slide) => ({
      ...slide,
      elements: slide.elements.map((el) =>
        el.id === id ? { ...el, locked: !el.locked } : el
      ),
    }));
    set({ slides });
  },

  bringToFront: (id) => {
    const state = get();
    const slide = state.slides[state.activeSlideIndex];
    if (!slide) return;
    const idx = slide.elements.findIndex((el) => el.id === id);
    if (idx < 0) return;
    const elements = [...slide.elements];
    const [el] = elements.splice(idx, 1);
    if (el) elements.push(el);
    const slides = [...state.slides];
    slides[state.activeSlideIndex] = { ...slide, elements };
    set({ slides, saveStatus: 'unsaved' });
  },

  sendToBack: (id) => {
    const state = get();
    const slide = state.slides[state.activeSlideIndex];
    if (!slide) return;
    const idx = slide.elements.findIndex((el) => el.id === id);
    if (idx < 0) return;
    const elements = [...slide.elements];
    const [el] = elements.splice(idx, 1);
    if (el) elements.unshift(el);
    const slides = [...state.slides];
    slides[state.activeSlideIndex] = { ...slide, elements };
    set({ slides, saveStatus: 'unsaved' });
  },

  addSlide: (partial) => {
    const state = get();
    state.pushHistory();
    const newSlide: EditorSlide = {
      id: crypto.randomUUID(),
      position: state.slides.length,
      elements: [],
      backgroundColor: '#ffffff',
      ...partial,
    };
    set({
      slides: [...state.slides, newSlide],
      activeSlideIndex: state.slides.length,
      saveStatus: 'unsaved',
    });
  },

  removeSlide: (index) => {
    const state = get();
    if (state.slides.length <= 1) return;
    state.pushHistory();
    const slides = state.slides.filter((_, i) => i !== index).map((s, i) => ({ ...s, position: i }));
    set({
      slides,
      activeSlideIndex: Math.min(state.activeSlideIndex, slides.length - 1),
      saveStatus: 'unsaved',
    });
  },

  duplicateSlide: (index) => {
    const state = get();
    state.pushHistory();
    const source = state.slides[index];
    if (!source) return;
    const newSlide: EditorSlide = {
      ...source,
      id: crypto.randomUUID(),
      position: state.slides.length,
      elements: source.elements.map((el) => ({ ...el, id: generateElementId() })),
    };
    const slides = [...state.slides];
    slides.splice(index + 1, 0, newSlide);
    set({
      slides: slides.map((s, i) => ({ ...s, position: i })),
      activeSlideIndex: index + 1,
      saveStatus: 'unsaved',
    });
  },

  reorderSlides: (fromIndex, toIndex) => {
    const state = get();
    state.pushHistory();
    const slides = [...state.slides];
    const [removed] = slides.splice(fromIndex, 1);
    if (removed) slides.splice(toIndex, 0, removed);
    set({
      slides: slides.map((s, i) => ({ ...s, position: i })),
      activeSlideIndex: toIndex,
      saveStatus: 'unsaved',
    });
  },

  updateSlideBackground: (color) => {
    const state = get();
    const slides = [...state.slides];
    const slide = slides[state.activeSlideIndex];
    if (slide) {
      slides[state.activeSlideIndex] = { ...slide, backgroundColor: color };
      set({ slides, saveStatus: 'unsaved' });
    }
  },

  replaceSlideWithImage: (imageSrc) => {
    const state = get();
    const slide = state.slides[state.activeSlideIndex];
    if (!slide) return;
    // Save history
    const entry: HistoryEntry = {
      slides: JSON.parse(JSON.stringify(state.slides)),
      activeSlideIndex: state.activeSlideIndex,
    };
    const history = state.history.slice(0, state.historyIndex + 1);
    history.push(entry);
    if (history.length > state.maxHistory) history.shift();
    // Replace slide elements with single full-size image
    const newSlides = [...state.slides];
    newSlides[state.activeSlideIndex] = {
      ...slide,
      elements: [{
        id: generateElementId(),
        type: 'Image' as const,
        name: 'IA Slide',
        visible: true,
        locked: false,
        attrs: { x: 0, y: 0, width: 1080, height: 1350, src: imageSrc, draggable: false },
      }],
    };
    set({
      slides: newSlides,
      selectedElementId: null,
      history,
      historyIndex: history.length - 1,
      saveStatus: 'unsaved',
    });
  },

  pushHistory: () => {
    const state = get();
    const entry: HistoryEntry = {
      slides: JSON.parse(JSON.stringify(state.slides)),
      activeSlideIndex: state.activeSlideIndex,
    };
    const history = state.history.slice(0, state.historyIndex + 1);
    history.push(entry);
    if (history.length > state.maxHistory) history.shift();
    set({ history, historyIndex: history.length - 1 });
  },

  undo: () => {
    const state = get();
    if (state.historyIndex < 0) return;
    const entry = state.history[state.historyIndex];
    if (!entry) return;
    set({
      slides: JSON.parse(JSON.stringify(entry.slides)),
      activeSlideIndex: entry.activeSlideIndex,
      historyIndex: state.historyIndex - 1,
      saveStatus: 'unsaved',
    });
  },

  redo: () => {
    const state = get();
    if (state.historyIndex >= state.history.length - 1) return;
    const entry = state.history[state.historyIndex + 1];
    if (!entry) {
      // Re-apply current state forward
      return;
    }
    set({
      slides: JSON.parse(JSON.stringify(entry.slides)),
      activeSlideIndex: entry.activeSlideIndex,
      historyIndex: state.historyIndex + 1,
      saveStatus: 'unsaved',
    });
  },

  canUndo: () => get().historyIndex >= 0,
  canRedo: () => get().historyIndex < get().history.length - 1,
}));
