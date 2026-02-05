/**
 * Animation functions for option picker sections
 */

export function sectionWrapperFadeIn(_node: Element) {
  return {
    duration: 200,
    delay: 50,
    css: (t: number) => `opacity: ${t}`,
  };
}

export function sectionWrapperFadeOut(_node: Element) {
  return {
    duration: 150,
    css: (t: number) => `opacity: ${t}`,
  };
}
