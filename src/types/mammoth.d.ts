declare module 'mammoth' {
  export interface ConvertToHtmlResult {
    value: string;
    messages: Array<{
      type: string;
      message: string;
    }>;
  }

  export interface ConvertToHtmlOptions {
    arrayBuffer?: ArrayBuffer;
    buffer?: Buffer;
    path?: string;
    styleMap?: string[];
    includeDefaultStyleMap?: boolean;
    includeEmbeddedStyleMap?: boolean;
    convertImage?: (image: any) => Promise<{ src: string; alt?: string }>;
    ignoreEmptyParagraphs?: boolean;
    idPrefix?: string;
  }

  export function convertToHtml(options: ConvertToHtmlOptions): Promise<ConvertToHtmlResult>;
  export function convertToMarkdown(options: ConvertToHtmlOptions): Promise<ConvertToHtmlResult>;
  export function extractRawText(options: ConvertToHtmlOptions): Promise<ConvertToHtmlResult>;
}

declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: number | number[];
    filename?: string;
    image?: {
      type?: string;
      quality?: number;
    };
    html2canvas?: {
      scale?: number;
      useCORS?: boolean;
      letterRendering?: boolean;
      allowTaint?: boolean;
      width?: number;
      height?: number;
    };
    jsPDF?: {
      unit?: string;
      format?: string | number[];
      orientation?: string;
      compress?: boolean;
    };
    pagebreak?: {
      mode?: string | string[];
      before?: string | string[];
      after?: string | string[];
      avoid?: string | string[];
    };
  }

  interface Html2Pdf {
    set(options: Html2PdfOptions): Html2Pdf;
    from(element: string | HTMLElement): Html2Pdf;
    to(type: string): Html2Pdf;
    output(type: string, options?: any): any;
    outputPdf(type?: string): Promise<Blob>;
    save(filename?: string): Promise<void>;
    then(onFulfilled?: (value: any) => any, onRejected?: (reason: any) => any): Promise<any>;
  }

  function html2pdf(): Html2Pdf;
  export = html2pdf;
} 