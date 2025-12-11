declare module 'docx' {
  export enum AlignmentType {
    LEFT = 'left',
    CENTER = 'center',
    RIGHT = 'right',
    JUSTIFIED = 'both',
  }

  export enum BorderStyle {
    SINGLE = 'single',
  }

  export enum VerticalAlign {
    TOP = 'top',
    CENTER = 'center',
  }

  export enum WidthType {
    AUTO = 'auto',
    PERCENTAGE = 'pct',
  }

  export enum PageOrientation {
    PORTRAIT = 'portrait',
    LANDSCAPE = 'landscape',
  }

  export class TextRun {
    constructor(options?: Record<string, unknown>)
  }

  export class Paragraph {
    constructor(options?: Record<string, unknown>)
  }

  export class Table {
    constructor(options?: Record<string, unknown>)
  }

  export class TableRow {
    constructor(options?: Record<string, unknown>)
  }

  export class TableCell {
    constructor(options?: Record<string, unknown>)
  }

  export class Document {
    constructor(options?: Record<string, unknown>)
  }

  export const Packer: {
    toBuffer(document: Document): Promise<Uint8Array>
  }
}