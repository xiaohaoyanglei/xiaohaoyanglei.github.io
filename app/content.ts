// All homepage text lives here. Edit this file to add news, papers or links;
// app/page.tsx only arranges it.

export const profile = {
  name: "Xiaohaoyang Lei",
  email: "xlei0009@student.monash.edu",
  scholar: "https://scholar.google.com/citations?hl=en&user=xVA6DYcAAAAJ",
  github: "https://github.com/xiaohaoyanglei",
  cv: "/xiaohaoyang-lei-cv.pdf",
  repository: "https://github.com/xiaohaoyanglei/xiaohaoyanglei.github.io",
  portrait: "/portrait-crop.jpg",
  portraitAlt: "Xiaohaoyang Lei with arms outstretched in front of a Monash University billboard",
  /** Used for the footer clock and the moon's orientation. */
  city: "Melbourne",
  timeZone: "Australia/Melbourne",
  lastUpdated: "November 2026",
  /** The arXiv-style stamp in the title page margin. */
  stamp: "xiaohaoyanglei.github.io  [cs.CV]  Nov 2026",
};

/** Title page, laid out like the first page of a paper. Keep it short. */
export const titlePage = {
  affiliations: [
    { mark: "1", name: "Monash University" },
    { mark: "2", name: "Southeast University–Monash University Joint Graduate School" },
  ],
  abstract:
    "I’m an M.Sc. student at Monash University working on generative models for image editing and video generation. Lately I’ve been drawn to action-conditioned video world models, which predict how a scene unfolds given what an agent does.",
  indexTerms: ["Image editing", "video generation", "diffusion models", "world models"],
};

export const chapters = [
  { id: "about", number: "", label: "Abstract" },
  { id: "news", number: "1", label: "News" },
  { id: "publications", number: "2", label: "Publications" },
  { id: "research", number: "3", label: "Research" },
  { id: "background", number: "4", label: "Background" },
  { id: "visitors", number: "A", label: "Visitors" },
] as const;

/** How many news items show before the rest fold under "Earlier news". */
export const visibleNews = 4;

export type NewsItem = {
  date: string;
  text: string;
  /** Optional in-page or external link appended to the item. */
  link?: { label: string; href: string };
};

export const news: NewsItem[] = [
  {
    date: "May 2026",
    text: "BlendEmo, our co-first-author paper on blended emotion recognition, was presented as an oral at IEEE FG 2026.",
    link: { label: "Paper", href: "#pub-blendemo" },
  },
  {
    date: "2025",
    text: "Started the M.Sc. in Data Science at Monash University, and joined the Southeast University–Monash University Joint Graduate School as a research assistant.",
  },
  {
    date: "2025",
    text: "Teaching assistant for Fundamentals of Artificial Intelligence, Machine Learning, and Natural Language Processing.",
  },
  {
    date: "2024",
    text: "Graduated from the University of Liverpool with a B.Eng. in Electrical Engineering and Electronics.",
  },
  {
    date: "Sep 2023",
    text: "Our monolithic GaN DC–DC floating buck converter was published in Semiconductor Science and Technology.",
    link: { label: "DOI", href: "https://doi.org/10.1088/1361-6641/ace648" },
  },
  {
    date: "2023",
    text: "Presented R2I, my first-author paper on photovoltaic fault diagnosis, as an oral at IEEE-EPEE 2023.",
    link: { label: "Paper", href: "#pub-r2i" },
  },
  {
    date: "2022",
    text: "Best Poster Award at the International Forum on Wide Bandgap Semiconductors (IFWS).",
  },
];

export type TeaserKind = "blendemo" | "r2i" | "gan" | "fpga";

export type Publication = {
  id: string;
  title: string;
  /** Author names as printed. The site owner's name is highlighted automatically. */
  authors: string[];
  /** Authors marked with an asterisk (equal contribution). */
  equalContribution?: string[];
  venue: string;
  /** Short form used in citation previews, e.g. "IEEE FG 2026". */
  venueShort: string;
  year: number;
  tags: string[];
  summary: string;
  teaser: TeaserKind;
  links: { label: string; href: string }[];
  bibtex: string;
};

export const selfName = "X. Lei";

export const publications: Publication[] = [
  {
    id: "blendemo",
    title:
      "BlendEmo: Structured set prediction and pair-conditioned ratio modeling for blended emotion recognition",
    authors: ["K. Cheng", "X. Lei", "R. Wang", "H. Li", "C. Chen"],
    equalContribution: ["K. Cheng", "X. Lei"],
    venue: "IEEE International Conference on Automatic Face and Gesture Recognition (FG)",
    venueShort: "IEEE FG 2026",
    year: 2026,
    tags: ["Oral", "Co-first author"],
    summary:
      "Recognises which two emotions are blended in a face and how much each contributes, using structured set prediction with pair-conditioned ratio decoding.",
    teaser: "blendemo",
    links: [],
    bibtex: `@inproceedings{cheng2026blendemo,
  title     = {{BlendEmo}: Structured set prediction and pair-conditioned ratio modeling for blended emotion recognition},
  author    = {Cheng, K. and Lei, X. and Wang, R. and Li, H. and Chen, C.},
  booktitle = {Proceedings of the IEEE International Conference on Automatic Face and Gesture Recognition (FG)},
  year      = {2026}
}`,
  },
  {
    id: "r2i",
    title:
      "R2I: A deep fault diagnosis semantic segmentation system based on knowledge distillation in photovoltaic panels",
    authors: ["X. Lei", "K. Ma", "J. Zhao"],
    venue: "International Conference on Energy, Power and Electrical Engineering (IEEE-EPEE)",
    venueShort: "IEEE-EPEE 2023",
    year: 2023,
    tags: ["Oral", "First author"],
    summary:
      "Distils an RGB U-Net teacher into a lightweight infrared student to segment panel faults, then estimates severity from the predicted defect area.",
    teaser: "r2i",
    links: [],
    bibtex: `@inproceedings{lei2023r2i,
  title     = {{R2I}: A deep fault diagnosis semantic segmentation system based on knowledge distillation in photovoltaic panels},
  author    = {Lei, X. and Ma, K. and Zhao, J.},
  booktitle = {International Conference on Energy, Power and Electrical Engineering (IEEE-EPEE)},
  year      = {2023}
}`,
  },
  {
    id: "gan",
    title: "A 35 V–5 V monolithic integrated GaN-based DC–DC floating buck converter",
    authors: ["Y. Zhu", "H. Su", "F. Li", "A. Li", "X. Lei", "M. Cui", "W.-C. Lai", "H. Wen", "W. Liu"],
    venue: "Semiconductor Science and Technology, vol. 38, no. 9, 095001",
    venueShort: "Semiconductor Science and Technology 2023",
    year: 2023,
    tags: ["Journal"],
    summary:
      "A GaN power IC that steps 35 V down to 5 V on a single chip. I worked on device characterisation, converter measurement and the paper's figures.",
    teaser: "gan",
    links: [{ label: "DOI", href: "https://doi.org/10.1088/1361-6641/ace648" }],
    bibtex: `@article{zhu2023gan,
  title   = {A 35 {V}--5 {V} monolithic integrated {GaN}-based {DC}--{DC} floating buck converter},
  author  = {Zhu, Yuhao and Su, Haodong and Li, Fan and Li, Ang and Lei, Xiaohaoyang and Cui, Miao and Lai, Wen-Cheng and Wen, Huiqing and Liu, Wen},
  journal = {Semiconductor Science and Technology},
  volume  = {38},
  number  = {9},
  pages   = {095001},
  year    = {2023},
  doi     = {10.1088/1361-6641/ace648}
}`,
  },
  {
    id: "fpga",
    title: "Review on the FPGA design optimization for ASIC",
    authors: ["X. Lei"],
    venue: "International Conference on Software Engineering and Machine Learning (ICSEML), vol. 4, pp. 524–531",
    venueShort: "ICSEML 2023",
    year: 2023,
    tags: ["Sole author"],
    summary:
      "Surveys how FPGA prototyping and optimisation techniques carry over into ASIC design flows.",
    teaser: "fpga",
    links: [],
    bibtex: `@inproceedings{lei2023fpga,
  title     = {Review on the {FPGA} design optimization for {ASIC}},
  author    = {Lei, X.},
  booktitle = {International Conference on Software Engineering and Machine Learning (ICSEML)},
  volume    = {4},
  pages     = {524--531},
  year      = {2023}
}`,
  },
];

export type BackgroundEntry = { when: string; title: string; place: string; note?: string };

export const education: BackgroundEntry[] = [
  { when: "2025 – now", title: "M.Sc. Data Science", place: "Monash University", note: "Melbourne, Australia" },
  {
    when: "2022 – 24",
    title: "B.Eng. Electrical Engineering and Electronics",
    place: "University of Liverpool",
    note: "2+2 joint programme, Liverpool, UK",
  },
  {
    when: "2020 – 22",
    title: "B.Eng. Telecommunications Engineering",
    place: "Xi’an Jiaotong-Liverpool University",
    note: "2+2 joint programme, Suzhou, China",
  },
];

export const experience: BackgroundEntry[] = [
  {
    when: "2025 – now",
    title: "Research Assistant",
    place: "Southeast University–Monash University Joint Graduate School",
    note: "Computer vision, affective computing and multimodal learning",
  },
  {
    when: "2024",
    title: "Trainee Engineer Intern",
    place: "BEHOME",
    note: "IoT RF modules, test PCBs and an emergency-broadcast application",
  },
  {
    when: "2022 – 23",
    title: "Research Assistant",
    place: "XJTLU Nano-Micro Fabrication Laboratory",
    note: "GaN device measurement, data processing and figures",
  },
];

export const teaching: BackgroundEntry[] = [
  { when: "2025 – now", title: "FIT5047", place: "Fundamentals of Artificial Intelligence" },
  { when: "2025 – now", title: "FIT5201", place: "Machine Learning" },
  { when: "2025 – now", title: "FIT5217", place: "Natural Language Processing" },
];

export const honours: BackgroundEntry[] = [
  { when: "2026", title: "Oral presentation", place: "IEEE FG" },
  { when: "2023", title: "Oral presentation", place: "IEEE-EPEE" },
  { when: "2022", title: "Best Poster Award", place: "IFWS" },
];
