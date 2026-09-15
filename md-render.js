// Markdown → inline-styled HTML for the 论点复盘 archive.
// Tuned for the shape of the review emails: stock sections (### #N TICKER…),
// pipe tables, ⚠️/📌 callouts, [[CHART:CODE]] placeholders.

export const T = {
  paper: '#faf8f4', surface: '#ffffff', ink: '#1b1a17', ink2: '#57524a', ink3: '#8b8478',
  rule: '#e5dfd3', ruleSoft: '#efeae0', accent: '#0f5d6b', accentSoft: '#e7f0f1',
  warn: '#b0740a', warnBg: '#fdf5e6', warnRule: '#e8d4a6',
  red: '#a3281d', redBg: '#fbeeec', green: '#1e6b45', amber: '#946200',
  serif: "'Instrument Serif','Songti SC','Noto Serif CJK SC',Georgia,serif",
  sans: "'IBM Plex Sans','PingFang SC','Hiragino Sans GB','Microsoft YaHei',system-ui,sans-serif",
  mono: "'IBM Plex Mono','SF Mono',ui-monospace,monospace"
};

const FOLD = [/^附录/, /13F/, /十家机构/, /瓶颈/, /热力图/];
const WARN_RE = /[⚠🔴🟡]/;
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const warnAttr = s => (WARN_RE.test(s) ? ' data-warn="1"' : '');

function inline(raw) {
  let s = esc(raw);
  s = s.replace(/`([^`]+)`/g, `<code style="font-family:${T.mono};font-size:.88em;background:${T.ruleSoft};padding:1px 5px;border-radius:4px">$1</code>`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, `<a href="$2" target="_blank" rel="noopener" style="color:${T.accent};text-decoration:none;border-bottom:1px solid ${T.accentSoft}">$1</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, `<strong style="font-weight:600;color:${T.ink}">$1</strong>`);
  return s;
}

const NUM = /^[−\-+]?[$¥₩₩]?[\d,]+(\.\d+)?[%x×]?$|^[−\-+][\d.]+(bp|pp|%)?$/;
const isNum = c => NUM.test(c.replace(/\*\*/g, '').trim());

function actionColor(txt) {
  if (/清仓/.test(txt)) return T.red;
  if (/减仓/.test(txt)) return T.red;
  if (/加仓/.test(txt)) return T.green;
  if (/待判读/.test(txt)) return T.amber;
  return T.ink2;
}

function slug(i, kind) { return kind + '-' + i; }

export function renderMarkdown(md, opts = {}) {
  const key = opts.key || 'x';
  const lines = md.replace(/\r/g, '').split('\n');
  const out = [];
  const toc = [];
  let title = '';
  let openStock = false, openFold = false, hid = 0;

  const closeStock = () => { if (openStock) { out.push('</section>'); openStock = false; } };
  const closeFold = () => { closeStock(); if (openFold) { out.push('</div></details>'); openFold = false; } };

  const para = buf => {
    if (!buf.length) return;
    const text = buf.join(' ').trim();
    if (!text) return;
    const italic = /^\*[^*]/.test(text) && /\*$/.test(text);
    const body = inline(italic ? text.replace(/^\*/, '').replace(/\*$/, '') : text);
    const lead = text.trim().charAt(0);
    if (WARN_RE.test(lead) || lead === '📌') {
      const isWarn = WARN_RE.test(lead);
      out.push(`<div data-block${warnAttr(text)} style="margin:16px 0;padding:14px 18px;border-left:3px solid ${isWarn ? T.warnRule : T.accentSoft};background:${isWarn ? T.warnBg : T.accentSoft}55;border-radius:0 8px 8px 0;line-height:1.85;color:${T.ink}">${body}</div>`);
    } else {
      out.push(`<p data-block${warnAttr(text)} style="margin:14px 0;line-height:1.9;color:${italic ? T.ink3 : T.ink2};font-size:${italic ? '.9em' : '1em'};font-style:${italic ? 'italic' : 'normal'};text-wrap:pretty">${body}</p>`);
    }
  };

  let buf = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();

    // blank
    if (!trimmed) { para(buf); buf = []; continue; }

    // horizontal rules / separators
    if (/^(-{3,}|—{4,}|_{3,})$/.test(trimmed)) {
      para(buf); buf = [];
      out.push(`<hr data-block style="border:0;border-top:1px solid ${T.rule};margin:34px 0">`);
      continue;
    }

    // chart / image placeholder
    // 占位符可能独占一行，也可能被写成列表项（不同期邮件两种格式都出现过，如 2026-09-05 的「- [[CHART:GOOGL]]」）
    let cm = trimmed.match(/^(?:(?:[-*+]|\d+[.)])\s+)?\[\[(CHART|IMG):([^\]]+)\]\]$/);
    if (cm) {
      para(buf); buf = [];
      const code = cm[2];
      out.push(`<figure data-block style="margin:22px 0 26px"><image-slot id="${key}-${cm[1]}-${code}" style="width:100%;height:clamp(240px,34vw,380px)" shape="rounded" radius="10" placeholder="拖入 ${code} ${cm[1] === 'IMG' ? '图片' : '技术图'}"></image-slot><figcaption style="margin-top:8px;font-family:${T.mono};font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:${T.ink3}">${cm[1]}:${esc(code)}</figcaption></figure>`);
      continue;
    }

    // headings
    const hm = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (hm) {
      para(buf); buf = [];
      const level = hm[1].length, text = hm[2].trim();
      if (level === 1) { title = text.replace(/\*\*/g, ''); continue; }

      if (level === 2) {
        closeFold();
        const id = slug(++hid, 'h2');
        const foldable = FOLD.some(r => r.test(text.replace(/[^\u4e00-\u9fa513FA-Za-z]/g, '')) || r.test(text));
        toc.push({ id, text: text.replace(/\*\*/g, ''), level: 2, pad: 0 });
        if (foldable) {
          openFold = true;
          out.push(`<details data-block id="${id}" style="margin:38px 0 0;border:1px solid ${T.rule};border-radius:12px;background:${T.surface}">`);
          out.push(`<summary style="cursor:pointer;padding:18px 22px;font-family:${T.serif};font-size:1.45rem;color:${T.ink};list-style:none">${inline(text)} <span style="font-family:${T.mono};font-size:.68rem;letter-spacing:.1em;color:${T.ink3};vertical-align:middle;margin-left:8px">点开展开</span></summary>`);
          out.push(`<div style="padding:4px 22px 22px">`);
        } else {
          out.push(`<h2 data-block id="${id}" style="margin:52px 0 6px;font-family:${T.serif};font-weight:400;font-size:clamp(1.7rem,3.2vw,2.3rem);line-height:1.25;color:${T.ink};letter-spacing:.01em">${inline(text)}</h2>`);
          out.push(`<div style="width:46px;height:2px;background:${T.accent};margin-bottom:22px"></div>`);
        }
        continue;
      }

      // level 3/4
      const stock = text.match(/^#(\d+)\s+([^(（]+)[（(]([^)）]*)[)）]\s*(.*)$/);
      if (level === 3 && stock) {
        closeStock();
        const [, rank, ticker, weight, rest] = stock;
        const id = 's-' + ticker.trim().replace(/[^\w\u4e00-\u9fa5]/g, '');
        const parts = rest.split('｜').map(s => s.trim()).filter(Boolean);
        toc.push({ id, text: `${ticker.trim()} · ${weight}`, level: 3, pad: 14 });
        openStock = true;
        out.push(`<section data-stock data-block id="${id}" style="margin:30px 0;padding:26px 28px;background:${T.surface};border:1px solid ${T.rule};border-radius:14px">`);
        out.push(`<header style="display:flex;flex-wrap:wrap;align-items:baseline;gap:10px 16px;padding-bottom:16px;margin-bottom:6px;border-bottom:1px solid ${T.ruleSoft}">
          <span style="font-family:${T.mono};font-size:.72rem;color:${T.ink3};letter-spacing:.1em">#${rank}</span>
          <span style="font-family:${T.mono};font-size:1.5rem;font-weight:500;color:${T.ink};letter-spacing:-.01em">${esc(ticker.trim())}</span>
          <span style="font-family:${T.mono};font-size:.85rem;color:${T.ink2};background:${T.ruleSoft};padding:3px 9px;border-radius:20px">${esc(weight)}</span>
          ${parts.map(p => `<span style="font-size:.85rem;color:${actionColor(p)};font-weight:${/动作|不动|清仓|减仓|加仓|待判读/.test(p) ? 600 : 400}">${inline(p)}</span>`).join('')}
        </header>`);
        continue;
      }

      const id = slug(++hid, 'h' + level);
      if (level === 3) { closeStock(); toc.push({ id, text: text.replace(/\*\*/g, ''), level: 3, pad: 14 }); }
      out.push(`<h${level} data-block id="${id}" style="margin:${level === 3 ? '34px 0 10px' : '24px 0 8px'};font-family:${T.sans};font-weight:600;font-size:${level === 3 ? '1.18rem' : '1.02rem'};color:${T.ink};letter-spacing:.01em">${inline(text)}</h${level}>`);
      continue;
    }

    // blockquote
    if (/^>\s?/.test(trimmed)) {
      para(buf); buf = [];
      const qb = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) { qb.push(lines[i].trim().replace(/^>\s?/, '')); i++; }
      i--;
      const txt = qb.join(' ');
      out.push(`<blockquote data-block${warnAttr(txt)} style="margin:20px 0;padding:16px 20px;background:${T.paper};border:1px solid ${T.rule};border-radius:10px;color:${T.ink2};font-size:.94rem;line-height:1.85">${inline(txt)}</blockquote>`);
      continue;
    }

    // table
    if (/^\|/.test(trimmed) && lines[i + 1] && /^\|[\s:\-|]+\|$/.test(lines[i + 1].trim())) {
      para(buf); buf = [];
      const cells = l => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      const head = cells(lines[i]); i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i].trim())) { rows.push(cells(lines[i])); i++; }
      i--;
      const th = head.map((h, ci) => `<th data-col="${ci}" style="position:sticky;top:0;background:${T.surface};text-align:left;padding:11px 12px;border-bottom:1px solid ${T.ink};font-family:${T.sans};font-weight:600;font-size:.8rem;color:${T.ink};white-space:nowrap;cursor:pointer;user-select:none">${inline(h)}<span data-arrow style="color:${T.ink3};font-size:.7em;margin-left:5px">⇅</span></th>`).join('');
      const tb = rows.map(r => `<tr${warnAttr(r.join(' '))} style="border-bottom:1px solid ${T.ruleSoft}">${r.map(c => `<td style="padding:10px 12px;font-size:.86rem;line-height:1.6;color:${T.ink2};vertical-align:top;${isNum(c) ? `font-family:${T.mono};white-space:nowrap;` : ''}">${inline(c)}</td>`).join('')}</tr>`).join('');
      out.push(`<div data-block style="margin:20px 0;overflow:auto;max-height:min(70vh,760px);border:1px solid ${T.rule};border-radius:10px;background:${T.surface}"><table data-sortable style="border-collapse:collapse;width:100%;min-width:min(100%,560px)"><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table></div>`);
      continue;
    }

    // list
    if (/^[-*]\s+/.test(trimmed) || /^\s+[-*]\s+/.test(line)) {
      para(buf); buf = [];
      const items = [];
      while (i < lines.length) {
        const l = lines[i];
        if (!l.trim()) break;
        const m = l.match(/^(\s*)[-*]\s+(.*)$/);
        // 整项就是一个图片占位符时让出来，交给上面的 image-slot 分支（2026-09-05 那期把 [[CHART:]] 写成了列表项）
        if (m && items.length && /^\[\[(CHART|IMG):[^\]]+\]\]$/.test(m[2].trim())) break;
        if (m) items.push({ depth: m[1].length >= 2 ? 1 : 0, text: m[2] });
        else if (items.length && /^\s+\S/.test(l)) items[items.length - 1].text += ' ' + l.trim();
        else break;
        i++;
      }
      i--;
      let html = '', depth = 0;
      const ulOpen = d => `<ul style="margin:${d ? '8px 0 0' : '14px 0'};padding-left:${d ? 18 : 20}px;list-style:none;display:flex;flex-direction:column;gap:${d ? 7 : 10}px">`;
      html += ulOpen(0);
      items.forEach(it => {
        if (it.depth > depth) { html += ulOpen(1); depth = 1; }
        else if (it.depth < depth) { html += '</ul>'; depth = 0; }
        const dot = it.depth ? '·' : '—';
        html += `<li${warnAttr(it.text)} style="line-height:1.85;color:${T.ink2};font-size:${it.depth ? '.94rem' : '1rem'};position:relative;padding-left:18px"><span style="position:absolute;left:0;color:${T.accent};font-family:${T.mono}">${dot}</span>${inline(it.text)}</li>`;
      });
      if (depth) html += '</ul>';
      html += '</ul>';
      out.push(`<div data-block${warnAttr(items.map(x => x.text).join(' '))}>${html}</div>`);
      continue;
    }

    buf.push(trimmed);
  }
  para(buf);
  closeFold();

  return { html: out.join('\n'), toc, title };
}
