import Image from "next/image";
import LineSidebar from "./line-sidebar";
import MobileNavigation from "./mobile-navigation";
import SectionCard from "./section-card";
import SideRays from "./side-rays";
import VisitorMap from "./visitor-map";

const education = [
  {
    period: "2025–Present",
    country: "Australia",
    institution: "Monash University",
    degree: "M.Sc. Data Science",
    location: "Melbourne",
    current: true,
  },
  {
    period: "2022–2024",
    country: "United Kingdom",
    institution: "University of Liverpool",
    degree: "B.Eng. Electrical Engineering & Electronics",
    location: "Liverpool",
    current: false,
  },
  {
    period: "2020–2022",
    country: "China",
    institution: "Xi’an Jiaotong-Liverpool University",
    degree: "B.Eng. Telecommunications Engineering",
    location: "Suzhou",
    current: false,
  },
];

const publications = [
  {
    year: "2026",
    title:
      "BlendEmo: Structured set prediction and pair-conditioned ratio modeling for blended emotion recognition",
    authors: "K. Cheng, X. Lei*, R. Wang, H. Li, and C. Chen",
    venue: "IEEE FG",
    tag: "Accepted",
    latest: true,
  },
  {
    year: "2023",
    title: "A 35 V–5 V monolithic integrated GaN-based DC–DC floating buck converter",
    authors: "Y. Zhu, H. Su, F. Li, A. Li, X. Lei, M. Cui, W.-C. Lai, H. Wen, and W. Liu",
    venue: "Semiconductor Science and Technology · 38 095001",
    tag: "Journal",
    latest: false,
  },
  {
    year: "2023",
    title:
      "R2I: A deep fault diagnosis semantic segmentation system based on knowledge distillation in photovoltaic panels",
    authors: "X. Lei, K. Ma, and J. Zhao",
    venue: "IEEE-EPEE",
    tag: "Conference",
    latest: false,
  },
  {
    year: "2023",
    title: "Review on the FPGA design optimization for ASIC",
    authors: "X. Lei",
    venue: "ICSEML · Vol. 4, pp. 524–531",
    tag: "Conference",
    latest: false,
  },
];

const experience = [
  {
    period: "2025–Present",
    institution: "Southeast University–Monash University Joint Graduate School",
    current: true,
    roles: [
      {
        title: "Research Assistant",
        detail: "Research spanning computer vision, affective computing, and multimodal learning.",
      },
      {
        title: "Teaching Assistant",
        detail: "Tutorials and assessment support for AI, machine learning, and natural language processing.",
      },
    ],
  },
  {
    period: "2024",
    institution: "BEHOME",
    current: false,
    roles: [
      {
        title: "Trainee Engineer Intern",
        detail: "IoT RF modules, test PCBs, and an emergency-broadcast application.",
      },
    ],
  },
  {
    period: "2022–2023",
    institution: "XJTLU Nano-Micro Fabrication Laboratory",
    current: false,
    roles: [
      {
        title: "Research Assistant",
        detail: "Device measurement, experimental data processing, scientific figures, and manuscript preparation.",
      },
    ],
  },
];

const sidebarItems = [
  { id: "interests", index: "RI", label: "Research interests", ariaLabel: "Research interests prelude" },
  { id: "education", index: "00", label: "Education" },
  { id: "experience", index: "01", label: "Experience" },
  { id: "research", index: "02", label: "Selected research" },
  { id: "publications", index: "03", label: "Publications" },
  { id: "honours", index: "04", label: "Honours" },
  { id: "toolkit", index: "05", label: "Toolkit" },
  { id: "contact", index: "06", label: "Contact" },
];

const toolkitGroups = [
  { label: "ML & Vision", tools: ["Python", "PyTorch", "scikit-learn"] },
  { label: "Scientific Computing", tools: ["MATLAB", "C/C++", "Verilog"] },
  { label: "Data & Analytics", tools: ["SQL", "Spark", "Power BI"] },
  { label: "Research Communication", tools: ["LaTeX"] },
];

function HighlightName({ authors }: { authors: string }) {
  return authors.split("X. Lei").map((part, index, fragments) => (
    <span key={`${part}-${index}`}>
      {part}
      {index < fragments.length - 1 ? <strong>X. Lei</strong> : null}
    </span>
  ));
}

function ExternalNote() {
  return <span className="sr-only"> (opens in a new tab)</span>;
}

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <div className="site-header-shell">
        <header className="site-header page-shell">
          <a className="wordmark" href="#top" aria-label="Xiaohaoyang Lei, home">
            <span className="wordmark-mark" aria-hidden="true">
              XL
            </span>
            <span>Xiaohaoyang Lei</span>
          </a>

          <nav className="nav desktop-nav" aria-label="Primary navigation">
            <a href="#education">Education</a>
            <a className="nav-experience" href="#experience">
              Experience
            </a>
            <a href="#research">Research</a>
            <a href="#publications">Publications</a>
            <a className="nav-cv" href="/xiaohaoyang-lei-cv.pdf" target="_blank" rel="noreferrer">
              CV <span aria-hidden="true">↗</span>
              <ExternalNote />
            </a>
          </nav>

          <MobileNavigation />
        </header>
      </div>

      <main id="main-content" tabIndex={-1}>
        <div className="hero-stage">
          <SideRays
            className="hero-rays"
            speed={2.4}
            rayColor1="#F0A72F"
            rayColor2="#315FF4"
            intensity={2.3}
            spread={2}
            origin="top-right"
            tilt={-4}
            saturation={1.55}
            blend={0.62}
            falloff={1.4}
            opacity={0.96}
          />
          <section className="hero page-shell" id="top" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="status-pill">
              <span aria-hidden="true" />
              M.Sc. Data Science · Monash University
            </p>
            <p className="eyebrow">Researcher · Data Scientist</p>
            <h1 className="hero-name" id="hero-title" aria-label="Xiaohaoyang Lei">
              <span className="hero-name-clip" aria-hidden="true">
                <span className="hero-name-word hero-name-first">Xiaohaoyang</span>
              </span>
              <span className="hero-name-clip" aria-hidden="true">
                <span className="hero-name-word hero-name-last">Lei</span>
              </span>
            </h1>
            <p className="hero-role">Building learning systems for visual intelligence.</p>
            <p className="hero-intro">
              My research moves from understanding blended human emotion to diagnosing faults in scientific and
              engineering data—uniting computer vision, affective computing, and deep learning.
            </p>
            <div className="hero-actions" aria-label="Profile links">
              <a className="button button-primary" href="mailto:xlei0009@student.monash.edu">
                Email me <span aria-hidden="true">→</span>
              </a>
              <a
                className="button"
                href="https://scholar.google.com/citations?hl=en&amp;user=xVA6DYcAAAAJ"
                target="_blank"
                rel="noreferrer"
              >
                Google Scholar <span aria-hidden="true">↗</span>
                <ExternalNote />
              </a>
            </div>
            <a className="hero-scroll" href="#interests">
              <span aria-hidden="true" />
              Explore profile
            </a>
          </div>

          <figure className="portrait-figure">
            <div className="portrait-matte">
              <div className="portrait-frame">
                <Image
                  src="/portrait-monash.jpg"
                  alt="Xiaohaoyang Lei on the Monash University campus"
                  fill
                  priority
                  unoptimized
                  sizes="(max-width: 760px) 100vw, 40vw"
                />
                <span className="portrait-index" aria-hidden="true">
                  PORTRAIT / 01
                </span>
                <span className="portrait-location" aria-hidden="true">
                  MEL · 2025
                </span>
              </div>
            </div>
            <figcaption>
              <span>Monash University</span>
              <span>Melbourne, Australia</span>
            </figcaption>
          </figure>
          </section>
        </div>

        <div className="profile-layout page-shell">
          <aside className="section-rail" aria-labelledby="section-rail-title">
            <p className="section-rail-label" id="section-rail-title">
              On this page
            </p>
            <LineSidebar items={sidebarItems} />
          </aside>

          <div className="content-stack">
          <SectionCard className="interests-card" delay={40}>
            <section className="focus-band" id="interests" aria-labelledby="focus-title">
              <div className="focus-intro">
                <h2 className="eyebrow" id="focus-title">
                  Research interests
                </h2>
                <p>Three connected areas shape the questions I pursue.</p>
              </div>
              <article className="focus-item">
                <span>01</span>
                <h3>Computer Vision</h3>
                <p>Robust visual representations for real-world signals.</p>
              </article>
              <article className="focus-item">
                <span>02</span>
                <h3>Affective Computing</h3>
                <p>Understanding blended and nuanced human emotion.</p>
              </article>
              <article className="focus-item">
                <span>03</span>
                <h3>Deep Learning</h3>
                <p>Efficient models for scientific and engineering data.</p>
              </article>
            </section>
          </SectionCard>

          <SectionCard className="education-card" delay={40}>
            <section className="education-section" id="education" aria-labelledby="education-title">
          <div className="education-heading">
            <div>
              <p className="section-index">00 / Education</p>
              <h2 id="education-title">Education</h2>
            </div>
            <p>An interdisciplinary path through data science, electrical engineering, and telecommunications.</p>
          </div>
          <div className="education-track">
            {education.map((item) => (
              <article key={`${item.period}-${item.institution}`}>
                <div className="education-meta">
                  <span>
                    {item.period} · {item.country}
                  </span>
                  {item.current ? <span className="current-badge">Current</span> : null}
                </div>
                <span className="education-node" aria-hidden="true" />
                <h3>{item.institution}</h3>
                <p>{item.degree}</p>
                <small>{item.location}</small>
              </article>
            ))}
          </div>
            </section>
          </SectionCard>

          <SectionCard className="experience-card" delay={60}>
            <section className="section" id="experience" aria-labelledby="experience-title">
              <div className="section-heading compact-heading">
                <div>
                  <p className="section-index">01 / Experience</p>
                  <h2 id="experience-title">Experience</h2>
                </div>
                <p>Research, teaching, and engineering—organized around the institutions where the work happened.</p>
              </div>

              <ol className="experience-timeline" aria-label="Professional experience by institution">
                {experience.map((item) => (
                  <li
                    className={`experience-event${item.current ? " is-current" : ""}`}
                    key={`${item.period}-${item.institution}`}
                  >
                    <span className="experience-node" aria-hidden="true" />
                    <div className="experience-period">
                      <span>{item.period}</span>
                      {item.current ? <span className="experience-current">Current</span> : null}
                    </div>
                    <article className="experience-entry">
                      <p className="experience-label">Institution</p>
                      <h3 className="experience-institution">{item.institution}</h3>
                      <div className="experience-roles">
                        {item.roles.map((role) => (
                          <div className="experience-role" key={role.title}>
                            <h4>{role.title}</h4>
                            <p>{role.detail}</p>
                          </div>
                        ))}
                      </div>
                    </article>
                  </li>
                ))}
              </ol>
            </section>
          </SectionCard>

          <SectionCard className="research-card" delay={70}>
            <section className="section section-with-art research-section" id="research" aria-labelledby="research-title">
          <div className="section-heading research-heading">
            <div>
              <p className="section-index">02 / Research</p>
              <h2 id="research-title">Selected Research</h2>
            </div>
            <p className="heading-aside">
              Three projects, one throughline: learning from complex real-world signals with methods that remain
              grounded in an applied scientific question.
            </p>
          </div>

          <div className="project-list">
            <article className="project-row">
              <div className="project-visual visual-emotion" aria-hidden="true">
                <span className="visual-code">B/E</span>
                <span className="emotion-grid" />
                <span className="visual-caption">SET / RATIO</span>
              </div>
              <div className="project-copy">
                <div className="project-meta">
                  <span>01 · Affective AI</span>
                  <span>2025–2026</span>
                </div>
                <h3>BlendEmo</h3>
                <p>
                  Structured set prediction and pair-conditioned ratio modelling for recognising blended facial
                  emotions, with task-consistent decoding across emotion pairs and salience.
                </p>
                <ol className="project-flow" aria-label="BlendEmo research workflow">
                  <li>Emotion pairs</li>
                  <li>Set prediction</li>
                  <li>Ratio decoding</li>
                </ol>
                <div className="project-outcome">
                  <span>Co-first author</span>
                  <span>IEEE FG 2026 · Accepted</span>
                </div>
              </div>
            </article>

            <article className="project-row project-row-reverse">
              <div className="project-visual visual-thermal" aria-hidden="true">
                <span className="thermal-disc" />
                <span className="visual-code">R2I</span>
                <span className="visual-caption">RGB → IR</span>
              </div>
              <div className="project-copy">
                <div className="project-meta">
                  <span>02 · Computer Vision</span>
                  <span>2023</span>
                </div>
                <h3>R2I</h3>
                <p>
                  RGB-to-infrared knowledge distillation for lightweight semantic segmentation, photovoltaic-panel
                  fault diagnosis, and mask-based severity estimation.
                </p>
                <ol className="project-flow" aria-label="R2I research workflow">
                  <li>RGB panels</li>
                  <li>Distillation</li>
                  <li>Thermal masks</li>
                </ol>
                <div className="project-outcome">
                  <span>First author</span>
                  <span>IEEE-EPEE 2023</span>
                </div>
              </div>
            </article>

            <article className="project-row">
              <div className="project-visual visual-gan" aria-hidden="true">
                <span className="gan-lines" />
                <span className="visual-code">35→5 V</span>
                <span className="visual-caption">GaN / DC–DC</span>
              </div>
              <div className="project-copy">
                <div className="project-meta">
                  <span>03 · Semiconductor Systems</span>
                  <span>2022–2023</span>
                </div>
                <h3>GaN Converter</h3>
                <p>
                  Device characterisation and measurement for a monolithic integrated GaN floating-buck converter,
                  including experimental analysis and publication figures.
                </p>
                <ol className="project-flow" aria-label="GaN converter research workflow">
                  <li>35 V input</li>
                  <li>Floating buck</li>
                  <li>5 V output</li>
                </ol>
                <div className="project-outcome">
                  <span>Co-author</span>
                  <span>Semiconductor Science and Technology · 2023</span>
                </div>
              </div>
            </article>
          </div>
            </section>
          </SectionCard>

          <SectionCard className="publications-card" delay={70}>
            <section
              className="section section-with-art publications-section"
              id="publications"
              aria-labelledby="publications-title"
            >
          <div className="section-heading compact-heading">
            <div>
              <p className="section-index">03 / Publications</p>
              <h2 id="publications-title">Publications</h2>
            </div>
            <div className="heading-aside publication-heading-aside">
              <p>Peer-reviewed work across affective computing, energy systems, semiconductor devices, and hardware.</p>
              <a
                className="text-link"
                href="https://scholar.google.com/citations?hl=en&amp;user=xVA6DYcAAAAJ"
                target="_blank"
                rel="noreferrer"
              >
                View Google Scholar <span aria-hidden="true">↗</span>
                <ExternalNote />
              </a>
            </div>
          </div>
          <div className="publication-summary" aria-label="Selected publication summary">
            <span>
              <strong>04</strong>
              selected works
            </span>
            <span>
              <strong>2023—26</strong>
              publication period
            </span>
            <span>
              <strong>01 / 03</strong>
              journal · conference
            </span>
          </div>
          <div className="publication-list">
            {publications.map((publication, index) => (
              <article
                className={`publication${publication.latest ? " is-featured" : ""}`}
                data-type={publication.tag}
                key={publication.title}
              >
                <div className="publication-marker">
                  <span>P{String(index + 1).padStart(2, "0")}</span>
                  <time dateTime={publication.year}>{publication.year}</time>
                  {publication.latest ? <span className="latest-badge">Latest</span> : null}
                </div>
                <div>
                  <h3>{publication.title}</h3>
                  <p>
                    <HighlightName authors={publication.authors} />
                  </p>
                </div>
                <div className="publication-venue">
                  <span>{publication.venue}</span>
                  <span className={`publication-tag publication-tag-${publication.tag.toLowerCase()}`}>
                    {publication.tag}
                  </span>
                </div>
              </article>
            ))}
          </div>
          <p className="publication-note">* Co-first author.</p>
            </section>
          </SectionCard>

          <SectionCard className="details-card" delay={70}>
            <section className="details-section section-with-art details-art-section" aria-labelledby="details-title">
          <h2 className="sr-only" id="details-title">
            Honours and technical profile
          </h2>
          <div className="detail-column" id="honours">
            <p className="section-index">04 / Honours</p>
            <ol className="honour-rail" aria-label="Selected honours">
              <li>
                <time dateTime="2026">2026</time>
                <span className="honour-node" aria-hidden="true">FG</span>
                <div>
                  <strong>Oral Presentation</strong>
                  <small>IEEE FG</small>
                </div>
              </li>
              <li>
                <time dateTime="2023">2023</time>
                <span className="honour-node" aria-hidden="true">EP</span>
                <div>
                  <strong>Oral Presentation</strong>
                  <small>IEEE-EPEE</small>
                </div>
              </li>
              <li className="is-award">
                <time dateTime="2022">2022</time>
                <span className="honour-node" aria-hidden="true">IF</span>
                <div>
                  <strong>Best Poster Award</strong>
                  <small>IFWS</small>
                </div>
              </li>
            </ol>
          </div>
          <div className="detail-column" id="toolkit">
            <div className="detail-heading-row">
              <p className="section-index">05 / Selected toolkit</p>
            </div>
            <div className="tool-grid">
              {toolkitGroups.map((group, index) => (
                <article className="tool-group" key={group.label}>
                  <span className="tool-index">0{index + 1}</span>
                  <h3>{group.label}</h3>
                  <div className="tool-tags">
                    {group.tools.map((tool) => (
                      <span key={tool}>{tool}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
            </section>
          </SectionCard>

          <SectionCard className="contact-card" delay={70}>
            <section
              className="contact section-with-art contact-art-section"
              id="contact"
              aria-labelledby="contact-title"
            >
          <div className="contact-copy">
            <p className="section-index">06 / Contact</p>
            <h2 id="contact-title">Let’s explore the next research question.</h2>
          </div>
          <div className="contact-links">
            <a className="contact-link contact-link-primary" href="mailto:xlei0009@student.monash.edu">
              <span>Email</span>
              <span>xlei0009@student.monash.edu →</span>
            </a>
            <a
              className="contact-link"
              href="https://scholar.google.com/citations?hl=en&amp;user=xVA6DYcAAAAJ"
              target="_blank"
              rel="noreferrer"
            >
              <span>Google Scholar</span>
              <span>View profile ↗</span>
              <ExternalNote />
            </a>
            <a className="contact-link" href="/xiaohaoyang-lei-cv.pdf" target="_blank" rel="noreferrer">
              <span>Curriculum Vitae</span>
              <span>Open PDF ↗</span>
              <ExternalNote />
            </a>
          </div>
            </section>
          </SectionCard>
          <SectionCard className="visitor-card" delay={70}>
            <VisitorMap />
          </SectionCard>
          </div>
        </div>
      </main>

      <footer className="footer page-shell">
        <span>© {new Date().getFullYear()} Xiaohaoyang Lei</span>
        <span>Visual intelligence · Scientific systems · Human-centred AI</span>
      </footer>
    </>
  );
}
