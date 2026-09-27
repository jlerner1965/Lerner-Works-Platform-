import { strToU8, zipSync } from "fflate";

/**
 * A small finished site (B7) for the tests and for the owner to try the upload with: five
 * pages, a stylesheet, one picture, a contact form that posts to the platform's endpoint, and
 * a 404 page. Plain HTML that any static host would serve; nothing here is a template.
 */
export const SAMPLE_SITE_NAME = "Harbor Lane Studio";

const css = `:root{--ink:#1f2a37;--paper:#fbf8f2;--accent:#b5541c}
*{box-sizing:border-box}body{margin:0;font:17px/1.6 Georgia,serif;color:var(--ink);background:var(--paper)}
header,main,footer{max-width:56rem;margin:0 auto;padding:1.5rem 1.25rem}
header{display:flex;align-items:center;justify-content:space-between;gap:1rem}
header a{color:var(--ink);text-decoration:none;margin-left:1rem}
h1{font-size:2.4rem;line-height:1.1;margin:0 0 .5rem}h2{margin-top:2rem}
.mark{width:44px;height:44px;vertical-align:middle}
.button{display:inline-block;background:var(--accent);color:#fff;padding:.6rem 1rem;border-radius:4px;text-decoration:none}
form label{display:block;margin:.75rem 0}form input,form textarea{width:100%;padding:.5rem;font:inherit;border:1px solid #c9c2b6;border-radius:4px}
.hp{position:absolute;left:-9999px}footer{color:#5b6472;font-size:.9rem;border-top:1px solid #e4dccc}
`;

const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" role="img" aria-label="Harbor Lane Studio mark"><circle cx="22" cy="22" r="20" fill="#b5541c"/><path d="M12 28c6-8 14-8 20 0" stroke="#fbf8f2" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · ${SAMPLE_SITE_NAME}</title>
<link rel="stylesheet" href="/css/site.css">
<link rel="icon" href="/images/mark.svg" type="image/svg+xml">
</head>
<body>
<header>
  <a href="/" style="margin:0"><img class="mark" src="/images/mark.svg" alt="" width="44" height="44"> ${SAMPLE_SITE_NAME}</a>
  <nav><a href="/about">About</a><a href="/work">Work</a><a href="/contact">Contact</a></nav>
</header>
<main>
${body}
</main>
<footer>${SAMPLE_SITE_NAME} is a fictional studio; this site is the sample that ships with the platform.</footer>
</body>
</html>
`;
}

/** The sample site's files by path. */
export function sampleUploadedSiteFiles(): Record<string, string> {
  return {
    "index.html": page("Home", `<h1>Furniture made to be handed down.</h1>
<p>A two-person studio on Harbor Lane building tables, benches and cabinets from regional hardwood, one commission at a time.</p>
<p><a class="button" href="/contact">Start a commission</a></p>
<h2>Recent work</h2>
<p>A walnut dining table for a family of six, an oak reading bench for the town library, and the cabinetry of a bakery counter that sees three hundred customers a morning.</p>`),
    "about.html": page("About", `<h1>About the studio</h1>
<p>Two makers, one shop, twenty years of joinery between them. Every piece is drawn by hand, built by hand, and delivered by the people who made it.</p>`),
    "work.html": page("Work", `<h1>Work</h1>
<ul>
<li>Dining tables in walnut, oak and ash</li>
<li>Benches and seating for public rooms</li>
<li>Counters and cabinetry for shops</li>
</ul>`),
    "contact.html": page("Contact", `<h1>Start a commission</h1>
<p>Tell us what you have in mind and where it will live. We answer within two working days.</p>
<form method="post" action="/_lw/inquiry">
  <input type="hidden" name="next" value="/thanks">
  <label>Name <input name="name" required autocomplete="name"></label>
  <label>Email <input name="email" type="email" required autocomplete="email"></label>
  <label>Phone (optional) <input name="phone" autocomplete="tel"></label>
  <label>What are you thinking of? <textarea name="message" rows="6" required></textarea></label>
  <label class="hp" aria-hidden="true">Leave this empty <input name="website" tabindex="-1" autocomplete="off"></label>
  <button class="button" type="submit">Send</button>
</form>`),
    "thanks.html": page("Thank you", `<h1>Thank you</h1>
<p>Your message is in. We answer within two working days.</p>
<p><a href="/">Back to the studio</a></p>`),
    "404.html": page("Not found", `<h1>That page is not here</h1>
<p>The address may have changed. <a href="/">Start from the front door.</a></p>`),
    "css/site.css": css,
    "images/mark.svg": mark,
    "robots.txt": "User-agent: *\nAllow: /\n",
  };
}

/** The sample site as the ZIP a person would upload. */
export function sampleUploadedSiteZip(): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  for (const [path, text] of Object.entries(sampleUploadedSiteFiles())) files[path] = strToU8(text);
  return zipSync(files, { level: 6 });
}
