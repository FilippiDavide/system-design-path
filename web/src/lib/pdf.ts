/**
 * Build a link that opens the book PDF at a given page. Kept free of
 * Node imports so client components can use it.
 *
 * @param page 1-based PDF page.
 * @returns Relative URL into `public/book.pdf`.
 */
export function pdfHref(page: number): string {
  return `/book.pdf#page=${page}`;
}
