import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import puppeteer from 'puppeteer';
import kendallTheme from 'jsonresume-theme-kendall';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const resumePath = path.join(root, 'resume.json');
const htmlPath = path.join(root, 'index.html');
const pdfPath = path.join(root, 'Justin_Reeves_Resume.pdf');

const resume = JSON.parse(await fs.readFile(resumePath, 'utf8'));
const themedHtml = kendallTheme.render(resume);
const html = injectDownloadControl(themedHtml);

await fs.writeFile(htmlPath, html);
await buildPdf(html, pdfPath, resume);

async function buildPdf(html, outputPath, fallbackResume) {
    try {
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle2' });
        await page.pdf({
            path: outputPath,
            format: 'Letter',
            printBackground: true,
            preferCSSPageSize: true,
            margin: {
                top: '0.4in',
                right: '0.4in',
                bottom: '0.45in',
                left: '0.4in'
            }
        });
        await browser.close();
        return;
    } catch (error) {
        console.warn('Kendall PDF export failed; falling back to text-only PDF:', error.message);
        await fs.writeFile(outputPath, buildFallbackPdf(fallbackResume));
    }
}

function injectDownloadControl(html) {
    const style = `
    <style>
      @media print {
        .no-print { display: none !important; }
      }
      .codex-download {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 9999;
        font-family: Arial, sans-serif;
      }
      .codex-download a {
        display: inline-block;
        padding: 10px 14px;
        border-radius: 999px;
        background: #111827;
        color: #fff !important;
        text-decoration: none;
        font-size: 13px;
        font-weight: 700;
        box-shadow: 0 10px 24px rgba(17, 24, 39, 0.18);
      }
    </style>`;

    const control = `
    <div class="no-print codex-download">
      <a href="Justin_Reeves_Resume.pdf" download>Download PDF</a>
    </div>`;

    return html.replace('</head>', `${style}\n</head>`).replace('<body>', `<body>${control}`);
}

function buildFallbackPdf(resume) {
    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;
    const bodySize = 10;
    const smallSize = 9;
    const titleSize = 20;
    const sectionSize = 11;
    const leadSize = 10;
    const lineGap = 4;

    const paragraphs = [];
    const add = (text, opts = {}) => paragraphs.push({ text: sanitizePdf(text), ...opts });
    const addBlank = (h = 8) => paragraphs.push({ blank: true, height: h });

    add(resume.basics.name, { size: titleSize, bold: true });
    add(resume.basics.label, { size: leadSize, italic: true, color: 'muted' });
    add(
        [
            `${resume.basics.location.city}, ${resume.basics.location.region}`,
            resume.basics.phone,
            resume.basics.email,
            resume.basics.url.replace(/^https?:\/\//, ''),
            'LinkedIn / justinreeves00'
        ].join(' | '),
        { size: smallSize, color: 'muted' }
    );
    addBlank(10);
    add('Summary', { size: sectionSize, bold: true });
    add(resume.basics.summary, { size: bodySize });
    addBlank(8);

    add('Experience', { size: sectionSize, bold: true });
    for (const job of resume.work) {
        add(`${job.name} - ${job.position}`, { size: bodySize + 0.5, bold: true });
        add(`${job.startDate.slice(0, 4)}${job.endDate ? ` - ${job.endDate.slice(0, 4)}` : ' - Present'}`, {
            size: smallSize,
            color: 'muted'
        });
        add(job.summary, { size: bodySize });
        for (const highlight of job.highlights) {
            add(`- ${highlight}`, { size: bodySize });
        }
        addBlank(6);
    }

    add('Projects', { size: sectionSize, bold: true });
    for (const project of resume.projects) {
        add(project.name, { size: bodySize + 0.5, bold: true });
        add(project.description, { size: bodySize });
        for (const highlight of project.highlights) {
            add(`- ${highlight}`, { size: bodySize });
        }
        addBlank(4);
    }

    add('Skills and Education', { size: sectionSize, bold: true });
    for (const skill of resume.skills) {
        add(`${skill.name}: ${skill.keywords.join(', ')}`, { size: bodySize });
    }
    addBlank(4);
    for (const item of resume.education) {
        add(item.institution, { size: bodySize + 0.5, bold: true });
        add(`${item.studyType} in ${item.area}`, { size: bodySize });
    }
    addBlank(4);
    add('Certifications', { size: bodySize + 0.5, bold: true });
    for (const cert of resume.certificates) {
        add(`- ${cert.name}${cert.issuer ? `, ${cert.issuer}` : ''}`, { size: bodySize });
    }

    const pages = [];
    let currentPage = [];
    let y = pageHeight - margin;

    const lineHeightFor = (size) => size * 1.28;
    const drawWrapped = (paragraph) => {
        if (paragraph.blank) {
            y -= paragraph.height;
            return;
        }

        const lines = wrapText(paragraph.text, paragraph.size, contentWidth);
        const lineHeight = lineHeightFor(paragraph.size);
        const needed = lines.length * lineHeight + lineGap;
        if (y - needed < margin) {
            pages.push(currentPage);
            currentPage = [];
            y = pageHeight - margin;
        }

        if (paragraph.size >= sectionSize) {
            y -= 6;
        }

        for (const line of lines) {
            currentPage.push({
                text: line,
                x: margin,
                y,
                size: paragraph.size,
                bold: Boolean(paragraph.bold),
                italic: Boolean(paragraph.italic),
                color: paragraph.color || 'black'
            });
            y -= lineHeight;
        }
        y -= lineGap;
    };

    for (const paragraph of paragraphs) {
        drawWrapped(paragraph);
    }
    if (currentPage.length) pages.push(currentPage);

    const objects = [];
    const addObject = (content) => {
        objects.push(content);
        return objects.length;
    };

    const fontRegular = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const fontBold = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    const fontItalic = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>');

    const pageIds = [];
    const contentIds = [];
    const pagesObjId = 4 + pages.length + pages.length;
    for (const pageLines of pages) {
        const contentStream = renderPageStream(pageLines);
        const contentId = addObject(
            `<< /Length ${Buffer.byteLength(contentStream, 'utf8')} >>\nstream\n${contentStream}\nendstream`
        );
        contentIds.push(contentId);
    }

    const pagesKids = [];
    for (let i = 0; i < pages.length; i++) {
        const pageObj = `<< /Type /Page /Parent ${pagesObjId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R /F3 ${fontItalic} 0 R >> >> /Contents ${contentIds[i]} 0 R >>`;
        pageIds.push(addObject(pageObj));
        pagesKids.push(`${pageIds[i]} 0 R`);
    }

    const pagesObj = addObject(`<< /Type /Pages /Kids [${pagesKids.join(' ')}] /Count ${pages.length} >>`);
    const catalogObj = addObject(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);

    const header = '%PDF-1.4\n%âãÏÓ\n';
    let body = '';
    const offsets = [0];
    let position = Buffer.byteLength(header, 'utf8');

    for (let i = 0; i < objects.length; i++) {
        const entry = `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
        offsets.push(position);
        body += entry;
        position += Buffer.byteLength(entry, 'utf8');
    }

    const xrefStart = position;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i < offsets.length; i++) {
        xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    const trailer = `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObj} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

    return Buffer.from(header + body + xref + trailer, 'utf8');
}

function renderPageStream(lines) {
    const chunks = [];
    let currentFont = null;
    let currentSize = null;
    let currentColor = null;

    const setFont = (bold, italic, size) => {
        const font = bold ? 'F2' : italic ? 'F3' : 'F1';
        if (font !== currentFont || size !== currentSize) {
            chunks.push(`/${font} ${size.toFixed(1)} Tf`);
            currentFont = font;
            currentSize = size;
        }
    };

    for (const line of lines) {
        const textColor = line.color === 'muted' ? '0.35 0.38 0.45' : '0 0 0';
        if (textColor !== currentColor) {
            chunks.push(`${textColor} rg`);
            currentColor = textColor;
        }
        setFont(line.bold, line.italic, line.size);
        chunks.push(`1 0 0 1 ${line.x.toFixed(2)} ${line.y.toFixed(2)} Tm`);
        chunks.push(`(${escapePdfText(line.text)}) Tj`);
    }

    return `BT\n${chunks.join('\n')}\nET`;
}

function wrapText(text, size, width) {
    const avgCharWidth = size * 0.52;
    const maxChars = Math.max(24, Math.floor(width / avgCharWidth));
    const words = String(text).split(/\s+/);
    const lines = [];
    let current = '';

    for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length > maxChars && current) {
            lines.push(current);
            current = word;
        } else {
            current = next;
        }
    }

    if (current) lines.push(current);
    return lines.length ? lines : [''];
}

function escapePdfText(value) {
    return sanitizePdf(value)
        .replaceAll('\\', '\\\\')
        .replaceAll('(', '\\(')
        .replaceAll(')', '\\)');
}

function sanitizePdf(value = '') {
    return String(value)
        .normalize('NFKD')
        .replaceAll('\u2019', "'")
        .replaceAll('\u2018', "'")
        .replaceAll('\u2014', '-')
        .replaceAll('\u2013', '-')
        .replaceAll('\u00a0', ' ')
        .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, '');
}
