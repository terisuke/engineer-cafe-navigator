export class SlideEventManager extends EventTarget {
  emitSlideTransitionStart(slideNumber: number): void {
    this.dispatchEvent(new CustomEvent('slideTransitionStart', {
      detail: { slideNumber }
    }));
  }
  
  emitSlideTransitionComplete(slideNumber: number): void {
    this.dispatchEvent(new CustomEvent('slideTransitionComplete', {
      detail: { slideNumber }
    }));
  }
  
  emitNarrationStart(slideNumber: number): void {
    this.dispatchEvent(new CustomEvent('narrationStart', {
      detail: { slideNumber }
    }));
  }
  
  emitNarrationComplete(slideNumber: number): void {
    this.dispatchEvent(new CustomEvent('narrationComplete', {
      detail: { slideNumber }
    }));
  }
}

export const slideEventManager = new SlideEventManager();