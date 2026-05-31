// Send a generated PDF Blob straight to the browser's print dialog, skipping the
// download step. Mounts the blob in an off-screen iframe and calls print() on its
// content window — Chrome/Edge (the desktop target) open the OS print dialog with
// the PDF loaded. If the iframe can't be printed directly (Firefox's PDF viewer
// blocks contentWindow.print()), fall back to opening the blob in a new tab where
// the user prints from the built-in viewer.

/** Print a PDF blob via the browser print dialog. No download. */
export function printPdfBlob(blob: Blob): void {
  if (typeof document === "undefined") return;

  const url = URL.createObjectURL(blob);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";

  let printed = false;
  const cleanup = () => {
    URL.revokeObjectURL(url);
    iframe.remove();
  };

  iframe.onload = () => {
    try {
      const win = iframe.contentWindow;
      if (!win) throw new Error("no content window");
      win.focus();
      win.print();
      printed = true;
    } catch {
      // PDF-in-iframe print blocked — hand the blob to a new tab instead.
      window.open(url, "_blank");
    }
    // Keep the blob alive long enough for the print spooler to read it, then
    // tear down. Revoking immediately cancels in-flight prints in some browsers.
    setTimeout(cleanup, printed ? 60_000 : 1_000);
  };

  iframe.src = url;
  document.body.appendChild(iframe);
}
