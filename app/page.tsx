import Bibtex from "./bibtex";
import Cite from "./cite";
import ConsoleGreeting from "./console-greeting";
import Contents from "./contents";
import CopyButton from "./copy-button";
import LocalClock from "./local-clock";
import PaperTeaser from "./paper-teaser";
import ProfileDock from "./profile-dock";
import ProfileLinks from "./profile-links";
import RunningHead from "./running-head";
import SampledPortrait from "./sampled-portrait";
import VisitorMap from "./visitor-map";
import WorldModelToy from "./world-model-toy";
import {
  chapters,
  education,
  experience,
  honours,
  news,
  profile,
  publications,
  selfName,
  teaching,
  titlePage,
  visibleNews,
  type BackgroundEntry,
  type NewsItem,
  type Publication,
} from "./content";

// The page is laid out like a paper: a calm title page (who, where, what, in
// a few lines), then numbered sections for anyone who wants the details. On
// wide screens the portrait and contact details dock into a margin card once
// the title page scrolls away (app/profile-dock.tsx).

function NewTab() {
  return <span className="sr-only"> (opens in a new tab)</span>;
}

function SectionHeading({ id }: { id: (typeof chapters)[number]["id"] }) {
  const chapter = chapters.find((item) => item.id === id);
  if (!chapter) return null;
  return (
    <h2 className="section-heading" id={`${id}-title`}>
      <span className="section-number">{chapter.number}</span>
      {chapter.label}
    </h2>
  );
}

function Authors({ paper }: { paper: Publication }) {
  const { authors, equalContribution = [] } = paper;
  return authors.map((name, index) => {
    const separator =
      index < authors.length - 2 ? ", " : index === authors.length - 2 ? (authors.length > 2 ? ", and " : " and ") : "";
    return (
      <span key={name}>
        {name === selfName ? <strong className="self">{name}</strong> : name}
        {equalContribution.includes(name) ? <sup aria-label="equal contribution">*</sup> : null}
        {separator}
      </span>
    );
  });
}

function NewsList({ items }: { items: NewsItem[] }) {
  return (
    <ol className="news">
      {items.map((item) => {
        const external = item.link?.href.startsWith("http");
        return (
          <li key={`${item.date}-${item.text.slice(0, 24)}`}>
            <span className="news-date">{item.date}</span>
            <p>
              {item.text}
              {item.link ? (
                <>
                  {" "}
                  <a href={item.link.href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
                    {item.link.label}
                    {external ? <NewTab /> : null}
                  </a>
                </>
              ) : null}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function BackgroundTable() {
  const groups: { label: string; entries: BackgroundEntry[] }[] = [
    { label: "Education", entries: education },
    { label: "Research and industry", entries: experience },
    {
      label: "Teaching",
      entries: [
        {
          when: teaching[0]?.when ?? "",
          title: "Teaching assistant",
          place: "Southeast University–Monash University Joint Graduate School",
          note: teaching.map((course) => `${course.title} ${course.place}`).join("; "),
        },
      ],
    },
    { label: "Honours", entries: honours },
  ];
  return (
    <figure className="figure table-figure">
      <figcaption>
        <span className="figure-label">Table 1.</span> Education, experience, teaching and honours.
      </figcaption>
      <table className="booktabs">
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Title</th>
            <th scope="col">Institution or venue</th>
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.label}>
            <tr className="group-row">
              <th colSpan={3} scope="rowgroup">
                {group.label}
              </th>
            </tr>
            {group.entries.map((entry) => (
              <tr key={`${entry.when}-${entry.title}-${entry.place}`}>
                <td className="cell-period">{entry.when}</td>
                <td className="cell-title">
                  {entry.title}
                  {entry.note ? <span className="cell-note">{entry.note}</span> : null}
                </td>
                <td className="cell-place">{entry.place}</td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </figure>
  );
}

export default function Home() {
  const [blendemo, r2i, gan] = publications;
  const recentNews = news.slice(0, visibleNews);
  const earlierNews = news.slice(visibleNews);

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <ConsoleGreeting email={profile.email} />
      <RunningHead chapters={chapters} name={profile.name} city={profile.city} />
      <Contents chapters={chapters} />
      <ProfileDock
        name={profile.name}
        affiliation={titlePage.affiliations[0]?.name ?? ""}
        email={profile.email}
        portrait={profile.portrait}
      />

      <main id="main-content" className="paper" tabIndex={-1}>
        <header className="title-page" id="about">
          <p className="stamp" aria-hidden="true">
            {profile.stamp}
          </p>
          <SampledPortrait src={profile.portrait} alt={profile.portraitAlt} />
          <h1 className="title" id="title">
            {profile.name}
            <sup aria-hidden="true">{titlePage.affiliations.map((item) => item.mark).join(",")}</sup>
          </h1>
          <p className="affiliations">
            {titlePage.affiliations.map((item) => (
              <span key={item.mark}>
                <sup>{item.mark}</sup>
                {item.name}
              </span>
            ))}
          </p>
          <p className="contact">
            <span className="contact-inner" data-dock-item="email">
              <a href={`mailto:${profile.email}`}>{profile.email}</a>
              <CopyButton text={profile.email} label="Copy email address" />
            </span>
          </p>
          <ProfileLinks className="link-buttons" />

          <section className="abstract" aria-labelledby="abstract-title">
            <h2 id="abstract-title">Abstract</h2>
            <p>{titlePage.abstract}</p>
            <p className="index-terms">
              <em>Index Terms</em>—{titlePage.indexTerms.join(", ")}.
            </p>
          </section>
        </header>

        <section className="paper-section" id="news" aria-labelledby="news-title">
          <SectionHeading id="news" />
          <NewsList items={recentNews} />
          {earlierNews.length > 0 ? (
            <details className="news-earlier">
              <summary>Earlier news ({earlierNews.length})</summary>
              <NewsList items={earlierNews} />
            </details>
          ) : null}
        </section>

        <section className="paper-section" id="publications" aria-labelledby="publications-title">
          <SectionHeading id="publications" />
          <p className="section-note">
            <sup>*</sup> Equal contribution. Hover or tap a figure to see the task it tackles. Full list on{" "}
            <a href={profile.scholar} target="_blank" rel="noreferrer">
              Google Scholar
              <NewTab />
            </a>
            .
          </p>
          <ol className="references">
            {publications.map((paper, index) => {
              const doi = paper.links.find((link) => link.label === "DOI");
              return (
                <li className="reference" id={`pub-${paper.id}`} key={paper.id}>
                  <span className="reference-number" aria-hidden="true">
                    [{index + 1}]
                  </span>
                  <PaperTeaser kind={paper.teaser} />
                  <div className="reference-body">
                    <h3 className="reference-title">
                      {doi ? (
                        <a href={doi.href} target="_blank" rel="noreferrer">
                          {paper.title}
                          <NewTab />
                        </a>
                      ) : (
                        paper.title
                      )}
                    </h3>
                    <p className="reference-authors">
                      <Authors paper={paper} />
                    </p>
                    <p className="reference-venue">
                      <span>
                        <em>{paper.venue}</em>, {paper.year}
                      </span>
                      {paper.tags.map((tag) => (
                        <span key={tag} className={`tag${tag === "Oral" ? " is-oral" : ""}`}>
                          {tag}
                        </span>
                      ))}
                    </p>
                    <p className="reference-summary">{paper.summary}</p>
                    <div className="reference-links">
                      {paper.links.map((link) => (
                        <a key={link.label} className="small-button" href={link.href} target="_blank" rel="noreferrer">
                          {link.label}
                          <NewTab />
                        </a>
                      ))}
                      <Bibtex id={paper.id} entry={paper.bibtex} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="paper-section" id="research" aria-labelledby="research-title">
          <SectionHeading id="research" />
          <p>
            <strong className="run-in">Now.</strong> Generative models for images and video. I’m interested in edits
            that change exactly what an instruction asks for and leave everything else alone, and in video generation
            that stays consistent from one frame to the next.
          </p>
          <p>
            <strong className="run-in">Next.</strong> Action-conditioned video world models, which roll a scene forward
            frame by frame given an agent’s actions: a step from generating video towards simulating the world it shows.
            Figure 1 is a toy version.
          </p>
          <p>
            <strong className="run-in">Before.</strong> Blended emotion recognition with structured set prediction{" "}
            <Cite paper={blendemo} number={1} />, RGB-to-infrared distillation for photovoltaic fault segmentation{" "}
            <Cite paper={r2i} number={2} />, and, as an undergraduate across XJTLU and Liverpool, measuring GaN power
            ICs <Cite paper={gan} number={3} />.
          </p>
          <figure className="figure toy-figure">
            <WorldModelToy />
            <figcaption>
              <span className="figure-label">Figure 1.</span> A toy action-conditioned world model. Choose an action
              (or use the arrow keys) and the next frame is denoised from noise, conditioned on it. The “model” is a
              hand-written renderer, not a trained network, so it never hallucinates.
            </figcaption>
          </figure>
        </section>

        <section className="paper-section" id="background" aria-labelledby="background-title">
          <SectionHeading id="background" />
          <BackgroundTable />
        </section>

        <section className="paper-section appendix" id="visitors" aria-labelledby="visitors-title">
          <SectionHeading id="visitors" />
          <p className="section-note">Where readers of this page come from. Counts are page views, not people.</p>
          <VisitorMap />
        </section>

        <footer className="acknowledgements">
          <p>
            <strong className="run-in">Acknowledgements.</strong> Thanks for reading. The moon in the running head
            follows tonight’s real lunar phase as seen from {profile.city}, where it is{" "}
            <LocalClock timeZone={profile.timeZone} /> right now.
          </p>
          <p className="colophon">
            © {new Date().getFullYear()} {profile.name}. Last updated {profile.lastUpdated}.{" "}
            <a href={profile.repository} target="_blank" rel="noreferrer">
              Source
              <NewTab />
            </a>
          </p>
        </footer>
      </main>
    </>
  );
}
