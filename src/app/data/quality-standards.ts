// ISSF Quality Standards & Decision Criteria

export const QUALITY_STANDARDS = {
  hedonic: {
    go: 7.0,
    tweak: 5.0,
    description: "9-point scale: 1=Dislike Extremely, 5=Neither, 9=Like Extremely"
  },
  emotionalBalance: {
    go: 2.0,
    tweak: 0,
    description: "Positive emotions minus negative emotions (EsSense25)"
  },
  offNotes: {
    maxOdourIntensity: 3,
    description: "Defect compounds (rancid, cardboard) must be below intensity 3 and sensory threshold"
  },
  cataAgreement: {
    strong: 60, // % panelists agreeing
    moderate: 40,
    description: "Percentage of semi-trained panelists selecting positive dairy attributes"
  },
  correlation: {
    strong: 0.85,
    moderate: 0.70,
    description: "Correlation between instrumental (e-tongue) and sensory panel data"
  }
};

export const DECISION_LOGIC = {
  GO: {
    label: "GO - Move Forward",
    color: "emerald",
    criteria: [
      "Hedonic overall ≥7.0/9 (Like moderately to extremely)",
      "No critical off-notes detected above threshold",
      "Emotional balance ≥+2.0 (positive dominant)",
      "≥60% panelist agreement on positive attributes",
      "Instrumental-sensory correlation r ≥0.85"
    ],
    action: "Ready for consumer testing or production scale-up"
  },
  TWEAK: {
    label: "TWEAK - Adjust Formula",
    color: "amber",
    criteria: [
      "Hedonic overall 5.0-6.9/9 (Acceptable but improvable)",
      "Minor off-notes present but manageable",
      "Emotional balance 0 to +1.9 (mixed response)",
      "40-59% panelist agreement (needs improvement)",
      "Instrumental-sensory correlation r = 0.70-0.84"
    ],
    action: "Reformulate and re-test specific attributes (saltiness, texture, etc.)"
  },
  STOP: {
    label: "STOP - Abandon Formula",
    color: "rose",
    criteria: [
      "Hedonic overall &lt;5.0/9 (Dislike)",
      "Critical defects: rancid/cardboard odours above threshold",
      "Negative emotions dominate (balance &lt;0)",
      "&lt;40% agreement or consensus on defects",
      "Poor correlation r &lt;0.70 (unreliable data)"
    ],
    action: "Fundamental formulation issues - start with new base formulation"
  }
};

export const JARGON_GLOSSARY = {
  "E-Tongue": "Electronic sensor system that objectively measures 9 taste dimensions (sourness, bitterness, umami, saltiness, etc.) - like a robot tongue that gives repeatable numbers instead of human opinions",
  "GC-MS": "Gas Chromatography-Mass Spectrometry - a machine that separates and identifies all the volatile flavor chemicals in the cheese",
  "Olfactometer": "A device that lets a human smell each chemical as it comes out of the GC-MS, combining chemical analysis with human perception",
  "CATA": "Check-All-That-Apply - a survey method where panelists select every flavor/aroma attribute they perceive (Milk, Butter, Nutty, Rancid, etc.)",
  "Hedonic": "How much you like or dislike something - rated on a 1-9 scale from 'Dislike Extremely' to 'Like Extremely'",
  "EsSense25": "A standardized emotional profiling method with 25 emotions (17 positive like Happy, Satisfied + 8 negative like Disgusted, Bored)",
  "PCA": "Principal Component Analysis - a statistical method that takes complex multi-dimensional data (9 taste dimensions) and plots it in 2D space so you can see patterns and clusters",
  "Semi-trained Panel": "Panelists who received 3-hour training on rating methods and flavor identification, but not the extensive training of professional panels (faster and more affordable)",
  "Threshold": "The minimum concentration of a chemical that humans can smell or taste - if concentration is above threshold, people will notice it",
  "Sensory Threshold": "The point where a chemical becomes detectable to human senses",
  "Off-notes": "Undesirable flavors or aromas like rancid, cardboard, or fermented smells - these are defects",
  "ISSF": "Integrated Sensory Screening Framework - this methodology combining instruments + semi-trained panels to make fast GO/TWEAK/STOP decisions"
};
