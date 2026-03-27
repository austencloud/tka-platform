import type { TeachingPortfolio } from "../domain/models/teaching-portfolio";

export const AUSTEN_PORTFOLIO_SEED: Omit<TeachingPortfolio, "userId" | "createdAt" | "updatedAt"> = {
  classes: [
    {
      id: "tka-1-learning-letters",
      title: "TKA 1: Learning Letters",
      level: "beginner",
      props: ["double-staves", "clubs"],
      description:
        "In this beginner class, we'll learn the foundations of antispins and isolations, focusing on using negative space and body turns to move through sequences. We will place a strict focus on thumb and prop orientation in order to learn motions without finger-spinning. We will learn the first letters in The Kinetic Alphabet - ABC, comprising split-same 1:1 motions. This will prepare use to learn our first three words in The Kinetic Alphabet. which we will tunnel to create 6 unique partner patterns.",
      themes: ["doubles", "clubs"],
      solo: true,
    },
    {
      id: "tka-2-writing-words",
      title: "TKA 2: Writing Words",
      level: "intermediate",
      props: ["mixed-static-props"],
      description:
        "In this intermediate class, we'll dive into The Kinetic Alphabet and learn how to use pictographs to create and communicate sequences. Students will be provided with reading material and laminated sheets of pictograph sequences to practice and share outside of class. Over the class, we'll construct these 19 unique starter sequences using the letters AV.",
      themes: ["mixed-prop-concepts", "static-prop-choreography"],
      solo: true,
    },
    {
      id: "tka-3-speaking-sentences",
      title: "TKA 3: Speaking Sentences",
      level: "advanced",
      props: ["double-staves", "mixed-static-props"],
      description:
        "In this class, we'll build on the previous classes, exploring more complex variations of the same sequences that we practiced in the first class by adding turns at different points. Then we'll integrate the dash and the static motion, learning 3 sequences that use them. We'll learn how to construct a circular word using higher-level sequences cards that students will keep. This will provide both intermediate and advanced practicioners with fresh material and a broader understanding.",
      themes: ["doubles", "mixed-prop-concepts", "static-prop-choreography"],
      solo: true,
    },
    {
      id: "intro-contact-juggling",
      title: "Intro to Contact Juggling - The Walking Halfpipe",
      level: "beginner",
      props: ["contact-ball"],
      description:
        "In this beginner-level class, we will disillusion the mysteries of contact juggling. We will learn the three steps to unlocking a balance point, using the cradle as an example. Then will explore palm transfers and simple forearm rolls. We will focus on the folding line and expand it on both sides with additional moves to create a long form sequence, covering a variety of transfers such as the lotus, the waterfall, and the butterfly.",
      themes: ["contact-juggling"],
      solo: true,
    },
    {
      id: "balloon-animal-funtime",
      title: "Balloon Animal Funtime Hour",
      level: "beginner",
      props: ["balloons"],
      description:
        "In this beginner-level class, we will learn the fundamentals of balloon sculpting, leaving you with the skills to twist yourself a friend wherever you go! We will learn simple designs like the dog, cat, flower, hat, sword, giraffe, rhino, bear, monkey, tiger. Balloons and pumps will be provided, and attendees will be given a bag of balloons to practice. Trash bags will be provided for MOOP and cleaning up balloon bits will be strongly encouraged!",
      themes: ["balloon-art"],
      solo: true,
    },
    {
      id: "intro-club-passing",
      title: "Intro to Club Passing",
      level: "beginner",
      props: ["clubs"],
      description:
        "We will learn how to throw clubs at each other without flinching! We'll begin with simple target practice drills and work our way slowly into 4-count. For the students who can do 4-count, we'll move on to 3-count, 2-count, doubles, doctors, tomahawks, and other intermediate trick throws.",
      themes: ["clubs", "partner-prop-concepts"],
      solo: false,
    },
    {
      id: "letting-go-of-your-poi",
      title: "Letting Go Of Your Poi",
      level: "mixed",
      props: ["poi"],
      description:
        "In this class, we will conquer the fear of letting go of your poi! We will learn many types of toss and catch points, including ones that involve grabbing the poi head, tossing underneath the legs or behind the back, tossing sideways, and no beats. We will combine these tosses to create two-poi sequences that pass through different modes of spinning.",
      themes: ["poi"],
      solo: true,
    },
  ],
  acts: [],
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
    website: "tkaflowarts.com",
    instagram: "@tkaflowarts",
    facebook: "facebook.com/tkaflowarts",
  },
  insuranceInfo: {
    provider: "Specialty Insurance Agency",
  },
  homeCity: "Chicago",
  homeCountry: "USA",
  yearsTeaching: 9,
  yearsPerforming: 12,
};
