// ===============================
// Online Sync Configuration
// ===============================
const API_URL = "https://script.google.com/macros/s/REPLACE_WITH_YOUR_DEPLOYED_URL/exec";

// ===============================
// Core helper: send payload to Apps Script
// ===============================
async function sendToServer(payload) {
    try {
        const res = await fetch(API_URL, {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        console.log("Server response:", data);
        return data;
    } catch (err) {
        console.error("Server error:", err);
        if (typeof showToast === "function") {
            showToast("Failed to sync with server", "error");
        }
        return null;
    }
}

// ===============================
// Safe wrappers: extend existing functions
// WITHOUT modifying original code
// ===============================

// ---- Wrap submitLog(status) ----
(function () {
    if (typeof window.submitLog !== "function") return;

    const originalSubmitLog = window.submitLog;

    window.submitLog = async function (status) {
        // Call original behavior first
        originalSubmitLog.call(this, status);

        try {
            // Guard: required globals must exist
            if (typeof currentStopIndex === "undefined" || !Array.isArray(stops)) return;
            if (!stops[currentStopIndex]) return;
            if (typeof sigCanvas === "undefined") return;

            const stop = stops[currentStopIndex];

            const payload = {
                action: "saveDelivery",
                timestamp: new Date().toISOString(),
                company: stop.company,
                address: stop.address,
                email: document.getElementById("p-email")?.value || "",
                phone: document.getElementById("p-phone")?.value || "",
                status: status,
                products: {
                    "18L": document.getElementById("p-18l")?.value || "0",
                    "small": document.getElementById("p-small")?.value || "0",
                    "18L_ret": document.getElementById("p-18l-ret")?.value || "0",
                    "cases": document.getElementById("p-cases")?.value || "0",
                    "small_ret": document.getElementById("p-small-ret")?.value || "0"
                },
                notes: document.getElementById("p-notes")?.value || "",
                receivedBy: document.getElementById("p-rec-by")?.value || "",
                signature: sigCanvas.toDataURL("image/png")
            };

            await sendToServer(payload);

            if (typeof showToast === "function") {
                showToast("Delivery saved online", "success");
            }
        } catch (e) {
            console.error("Extended submitLog error:", e);
        }
    };
})();

// ---- Wrap downloadPDF() if it exists ----
(function () {
    if (typeof window.downloadPDF !== "function") return;

    const originalDownloadPDF = window.downloadPDF;

    window.downloadPDF = async function () {
        const result = originalDownloadPDF.apply(this, arguments);

        try {
            // Expect jsPDF to be used and last instance to be accessible
            // If your original code returns the pdf instance, we can use that
            let pdf = result;

            // If not returned, we can't reliably grab it; in that case, skip upload
            if (!pdf || typeof pdf.output !== "function") {
                console.warn("downloadPDF wrapper: no pdf instance returned; skipping upload");
                return result;
            }

            const pdfBase64 = pdf.output("datauristring").split(",")[1];

            let stop = null;
            if (typeof currentStopIndex !== "undefined" && Array.isArray(stops)) {
                stop = stops[currentStopIndex] || null;
            }

            await sendToServer({
                action: "uploadPDF",
                filename: `${(stop?.company || "Receipt")}_${Date.now()}.pdf`,
                pdf: pdfBase64
            });

            if (typeof showToast === "function") {
                showToast("PDF uploaded online", "success");
            }
        } catch (e) {
            console.error("Extended downloadPDF error:", e);
        }

        return result;
    };
})();

// ---- Wrap exportToCSV() if it exists ----
(function () {
    if (typeof window.exportToCSV !== "function") return;

    const originalExportToCSV = window.exportToCSV;

    window.exportToCSV = async function () {
        const result = originalExportToCSV.apply(this, arguments);

        try {
            if (!Array.isArray(window.deliveryLogs)) {
                console.warn("exportToCSV wrapper: deliveryLogs not found or not array");
                return result;
            }

            await sendToServer({
                action: "saveDailySummary",
                date: new Date().toISOString().split("T")[0],
                logs: window.deliveryLogs
            });

            if (typeof showToast === "function") {
                showToast("Daily summary saved online", "success");
            }
        } catch (e) {
            console.error("Extended exportToCSV error:", e);
        }

        return result;
    };
})();
