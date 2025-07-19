import { Link, useNavigate, useParams } from "react-router";
import { useEffect, useState } from "react";
import { usePuterStore } from "~/lib/puter";
import Summary from "~/components/Summary";
import ATS from "~/components/ATS";
import Details from "~/components/Details";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { PDFDocument } from "pdf-lib";
export const meta = () => [
  { title: "Resumind | Review " },
  { name: "description", content: "Detailed overview of your resume" },
];

const Resume = () => {
  const { auth, isLoading, fs, kv } = usePuterStore();
  const { id } = useParams();
  const [imageUrl, setImageUrl] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [resumeData, setResumeData] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !auth.isAuthenticated)
      navigate(`/auth?next=/resume/${id}`);
  }, [isLoading]);

  useEffect(() => {
    const loadResume = async () => {
      const resume = await kv.get(`resume:${id}`);

      if (!resume) return;

      const data = JSON.parse(resume);
      setResumeData(data);

      const resumeBlob = await fs.read(data.resumePath);
      if (!resumeBlob) return;

      const pdfBlob = new Blob([resumeBlob], { type: "application/pdf" });
      const resumeUrl = URL.createObjectURL(pdfBlob);
      setResumeUrl(resumeUrl);

      const imageBlob = await fs.read(data.imagePath);
      if (!imageBlob) return;
      const imageUrl = URL.createObjectURL(imageBlob);
      setImageUrl(imageUrl);

      setFeedback(data.feedback);
      console.log({ resumeUrl, imageUrl, feedback: data.feedback });
    };

    loadResume();
  }, [id]);

  const handleDownloadPDF = async () => {
    if (!resumeData) return;

    // 1. Fetch the original resume PDF as ArrayBuffer
    const existingPdfBytes = await fetch(resumeUrl).then((res) =>
      res.arrayBuffer()
    );
    const originalPdf = await PDFDocument.load(existingPdfBytes);

    // 2. Create your report with jsPDF
    const reportDoc = new jsPDF();
    reportDoc.setFontSize(18);
    const pageWidth = reportDoc.internal.pageSize.getWidth();
    const title = "Resume Feedback Report";
    const textWidth = reportDoc.getTextWidth(title);
    const x = (pageWidth - textWidth) / 2;
    reportDoc.text(title, x, 10);
    reportDoc.setFontSize(12);
    const companyText = `Company Name: ${resumeData.companyName || "N/A"}`;
    const jobText = `Job Title: ${resumeData.jobTitle || "N/A"}`;
    const jobTextWidth = reportDoc.getTextWidth(jobText);
    reportDoc.text(companyText, 10, 20);
    reportDoc.text(jobText, pageWidth - jobTextWidth - 10, 20);
    reportDoc.setFontSize(14);
    reportDoc.text("Scores", pageWidth / 2, 32, { align: "center" });
    const tableBody = [
      ["Overall Score", resumeData.feedback?.overallScore ?? "N/A"],
      ["ATS Score", resumeData.feedback?.ATS?.score ?? "N/A"],
      ["Tone & Style", resumeData.feedback?.toneAndStyle?.score ?? "N/A"],
      ["Content", resumeData.feedback?.content?.score ?? "N/A"],
      ["Structure", resumeData.feedback?.structure?.score ?? "N/A"],
      ["Skills", resumeData.feedback?.skills?.score ?? "N/A"],
    ];
    autoTable(reportDoc, {
      startY: 36,
      head: [["Category", "Score"]],
      body: tableBody,
      theme: "grid",
      styles: { halign: "center" },
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: 40,
        fontStyle: "bold",
      },
      columnStyles: {
        0: { halign: "left" },
        1: { halign: "center" },
      },
      tableWidth: "auto",
      margin: { left: 10, right: 10 },
    });
    let y =
      ((reportDoc as any).lastAutoTable?.finalY ||
        (reportDoc as any).autoTable?.previous?.finalY ||
        50) + 10;
    const categories = [
      { key: "toneAndStyle", label: "Tone & Style" },
      { key: "content", label: "Content" },
      { key: "structure", label: "Structure" },
      { key: "skills", label: "Skills" },
    ];
    categories.forEach((cat) => {
      const catData = resumeData.feedback?.[cat.key];
      if (catData && Array.isArray(catData.tips) && catData.tips.length > 0) {
        reportDoc.setFontSize(14);
        reportDoc.text(`${cat.label} Tips:`, 10, y);
        y += 7;
        reportDoc.setFontSize(12);
        catData.tips.forEach((tip: any, idx: number) => {
          let tipType = tip.type ? `[${tip.type}] ` : "";
          let tipText =
            typeof tip === "string"
              ? tip
              : tip.tip || tip.text || JSON.stringify(tip);
          let explanation = tip.explanation ? ` (${tip.explanation})` : "";
          const fullTip = `- ${tipType}${tipText}${explanation}`;
          const lines = reportDoc.splitTextToSize(fullTip, 180);
          reportDoc.text(lines, 12, y);
          y += lines.length * 6 + 1;
          if (y > 270) {
            reportDoc.addPage();
            y = 10;
          }
        });
        y += 3;
      }
    });

    // 3. Export the report as PDF bytes
    const reportPdfBytes = reportDoc.output("arraybuffer");
    const reportPdf = await PDFDocument.load(reportPdfBytes);

    // 4. Merge the two PDFs
    const mergedPdf = await PDFDocument.create();
    // Add all pages from the original resume
    const originalPages = await mergedPdf.copyPages(
      originalPdf,
      originalPdf.getPageIndices()
    );
    originalPages.forEach((page) => mergedPdf.addPage(page));
    // Add all pages from the report
    const reportPages = await mergedPdf.copyPages(
      reportPdf,
      reportPdf.getPageIndices()
    );
    reportPages.forEach((page) => mergedPdf.addPage(page));

    // 5. Download the merged PDF
    const mergedPdfBytes = await mergedPdf.save();
    const blob = new Blob([mergedPdfBytes], { type: "application/pdf" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "resume-with-report.pdf";
    link.click();
  };

  return (
    <main className="!pt-0">
      <nav className="resume-nav">
        <Link to="/" className="back-button">
          <img src="/icons/back.svg" alt="logo" className="w-2.5 h-2.5" />
          <span className="text-gray-800 text-sm font-semibold">
            Back to Homepage
          </span>
        </Link>
        <button onClick={handleDownloadPDF} className="back-button">
          <img src="/icons/download.svg" alt="logo" className="w-6 h-6" />
          <span className="text-gray-800 text-sm font-semibold">
            Download PDF Report
          </span>
        </button>
      </nav>
      <div className="flex flex-row w-full max-lg:flex-col-reverse">
        <section className="feedback-section bg-[url('/images/bg-small.svg') bg-cover h-[100vh] sticky top-0 items-center justify-center">
          {imageUrl && resumeUrl && (
            <div className="animate-in fade-in duration-1000 gradient-border max-sm:m-0 h-[90%] max-wxl:h-fit w-fit">
              <a href={resumeUrl} target="_blank" rel="noopener noreferrer">
                <img
                  src={imageUrl}
                  className="w-full h-full object-contain rounded-2xl"
                  title="resume"
                />
              </a>
            </div>
          )}
        </section>
        <section className="feedback-section">
          <h2 className="text-4xl !text-black font-bold">Resume Review</h2>
          {feedback ? (
            <div className="flex flex-col gap-8 animate-in fade-in duration-1000">
              <Summary feedback={feedback} />
              <ATS
                score={feedback.ATS.score || 0}
                suggestions={feedback.ATS.tips || []}
              />
              <Details feedback={feedback} />
            </div>
          ) : (
            <img src="/images/resume-scan-2.gif" className="w-full" />
          )}
        </section>
      </div>
    </main>
  );
};
export default Resume;
