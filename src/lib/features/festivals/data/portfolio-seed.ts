import type { TeachingPortfolio } from "../domain/models/teaching-portfolio";

export const AUSTEN_PORTFOLIO_SEED: Omit<TeachingPortfolio, "userId" | "createdAt" | "updatedAt"> = {
  classes: [
    {
      id: "tka-1-learning-letters",
      title: "TKA 1: Learning Letters",
      level: "beginner",
      props: ["double-staves", "clubs"],
      description:
        "Foundations of antispins and isolations using negative space and body turns. Strict focus on thumb and prop orientation without finger-spinning. Letters A-B-C comprising split-same 1:1 motions. First three TKA words tunneled into 6 partner patterns.",
      themes: ["doubles", "clubs"],
      solo: true,
    },
    {
      id: "tka-2-writing-words",
      title: "TKA 2: Writing Words",
      level: "intermediate",
      props: ["mixed-static-props"],
      description:
        "Dive into The Kinetic Alphabet pictographs to create and communicate sequences. Students receive laminated sheets of pictograph sequences to practice and share. Construct 19 unique starter sequences using letters A-V.",
      themes: ["mixed-prop-concepts", "static-prop-choreography"],
      solo: true,
    },
    {
      id: "tka-3-speaking-sentences",
      title: "TKA 3: Speaking Sentences",
      level: "advanced",
      props: ["double-staves", "mixed-static-props"],
      description:
        "Builds on previous classes with complex variations using turns at different points. Integrates dash and static motions with 3 new sequences. Construct circular words using higher-level sequence cards for intermediate and advanced practitioners.",
      themes: ["doubles", "mixed-prop-concepts", "static-prop-choreography"],
      solo: true,
    },
    {
      id: "intro-contact-juggling",
      title: "Intro to Contact Juggling: The Walking Halfpipe",
      level: "beginner",
      props: ["contact-ball"],
      description:
        "Three steps to unlocking a balance point using the cradle. Palm transfers and simple forearm rolls. Expand the folding line on both sides: lotus, waterfall, butterfly.",
      themes: ["contact-juggling"],
      solo: true,
    },
    {
      id: "balloon-animal-funtime",
      title: "Balloon Animal Funtime Hour",
      level: "beginner",
      props: ["balloons"],
      description:
        "Balloon sculpting fundamentals: dog, cat, flower, hat, sword, giraffe, rhino, bear, monkey, tiger. Materials and pumps provided. MOOP cleanup encouraged.",
      themes: ["balloon-art"],
      solo: true,
    },
    {
      id: "intro-club-passing",
      title: "Intro to Club Passing",
      level: "beginner",
      props: ["clubs"],
      description:
        "Target practice drills progressing to 4-count, 3-count, 2-count, doubles, doctors, tomahawks, and intermediate trick throws.",
      themes: ["clubs", "partner-prop-concepts"],
      solo: false,
    },
    {
      id: "letting-go-of-your-poi",
      title: "Letting Go Of Your Poi",
      level: "mixed",
      props: ["poi"],
      description:
        "Toss and catch points: grabbing poi head, under-leg/behind-back tosses, sideways, no beats. Combine tosses into two-poi sequences through different spinning modes.",
      themes: ["poi"],
      solo: true,
    },
  ],
  bios: [
    {
      id: "teaching-bio",
      label: "Teaching Bio",
      text: "Austen Cloud is a Chicago-based flow artist, juggler, and performer. He began his flow arts journey in 2014 and has been teaching classes at flow arts festivals and in his local Chicago community since 2017. His greatest passion is The Kinetic Alphabet, a notation and choreography transcription system designed to facilitate group choreography and large-scale synchronized performances that celebrate the complexity and beauty of flow arts.",
    },
    {
      id: "performing-bio",
      label: "Performing Bio",
      text: "Austen has been an avid lover of all flow arts since 2014 and is deeply passionate about teaching and performing. His biggest passion is The Kinetic Alphabet, a notation system designed to make choreography more accessible and communicable. He hopes to foster a culture of group collaboration so that flow arts techniques can expand and reach a higher level of appreciation and widespread involvement.",
    },
  ],
  performanceCredits: [
    "Black Circle",
    "Pyrotechniq",
    "Red Mink",
    "Stage Factor",
    "Cirque Aflame (own troupe since 2020)",
  ],
  performanceVideos: [
    "https://youtu.be/aTV3rtOIshU",
    "https://youtu.be/5k-aGn0nxLY",
    "https://youtu.be/c1AzCYasT-g?si=johN0ahBg41Xpa1E&t=378",
  ],
  socialLinks: {
    website: "thekineticalphabet.com",
    instagram: "@thekineticalphabet",
    facebook: "facebook.com/TheKineticAlphabet",
  },
  insuranceInfo: {
    provider: "Specialty Insurance Agency",
  },
  homeCity: "Chicago",
  homeCountry: "USA",
  yearsTeaching: 9,
  yearsPerforming: 12,
};
