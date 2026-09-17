import type { LayoutStrings, LeadEmail } from './email.layout';

export const EN_LAYOUT: LayoutStrings = {
  htmlLang: 'en',
  fontFamily: "Georgia, 'Times New Roman', serif",
  signature: 'Suokjoon Moon',
  senderBlock:
    'Patient Funnel · Suokjoon Moon · 602 Yeongdong-daero, 6F z208, Gangnam-gu, Seoul 06083, Korea · patientsfunnel@gmail.com',
  why: 'You are getting this because you asked for the free edition of Patient Funnel at thepatientfunnel.com.',
  unsubscribe: 'Unsubscribe from these emails',
};

/** Step 1 is sent immediately; {{download}} is replaced with the PDF link. */
export const EN_EMAILS: LeadEmail[] = [
  {
    subject: 'Your free edition — start with one small change',
    body: [
      'Here is your free edition of Patient Funnel: the ten-stage model, Arrival and Waiting in full, and the 30-point audit at the back.',
      '{{download}}',
      'Start with sections 4.4 and 4.5. Then walk in through the entrance your patients use and spend ten minutes in your waiting room. Write down one moment when a new patient would not know what to do next.',
      'Choose one thing your existing team can change this week: the arrival instructions, the first greeting, or the way you explain a delay. Give it an owner and a date to check it again.',
      'The audit at the back will help you choose the next stage. There is no need to fix all ten at once.',
      '{{schedule}}',
    ],
  },
  {
    subject: 'One walk through your practice, three questions',
    body: [
      'Before changing your advertising, try this with the free edition open at Arrival and Waiting.',
      '1. Can a first-time patient find the entrance and understand where to go without calling you?',
      '2. At the desk, does someone acknowledge them and explain what happens next?',
      '3. If there is a delay, do they know why they are waiting and when they will hear from you again?',
      'Ask a colleague to walk the route with you. Choose one unclear moment and change it. A clearer arrival message or a timely update may be enough to begin.',
      'Check the same moment at the end of the week. Did the patient still have to ask? Record what happened; you do not need a new system to start.',
      '[See how the full book covers the other stages](https://thepatientfunnel.com/en/#use-the-book)',
    ],
  },
  {
    subject: 'What did you change — and what happened?',
    body: [
      'By now you may have spotted one gap in Arrival or Waiting. The next step is to check whether your change actually helped.',
      'Write three short lines: what patients were unsure about; what your team changed; what you observed afterwards. If you have not tried anything yet, those three lines can be your plan for this week.',
      'Then open the audit at the back. Which stage needs attention next? A low score is a place to investigate, not a verdict on your practice.',
      'Reply with the stage and one observation. For example: "Waiting — we now explain the delay at check-in, but patients still ask when they will be called." Please leave out patient names and other identifying details.',
      'That is more useful to me than a score alone. It also gives you a concrete question to bring to the next team meeting.',
    ],
  },
  {
    subject: 'From one change to a weekly routine',
    body: [
      'One change is a start. Keeping track of it is what turns it into a routine your team can repeat.',
      'The full book covers all ten stages. Use Appendix A to choose a priority, Appendix B to record the weekly numbers, and Appendix C to decide what to work on during the first 90 days.',
      'You do not need to reproduce the size of my clinic. Start with one stage, one responsible person and one measure your team can collect. Where you do not have a number yet, record that gap before setting a target.',
      'The examples come from my Korean practice and coaching work. Use them to examine your process, and adapt the actions to your team and local setting. They are not a prediction of what this book will earn for you.',
      '[Look inside the weekly sheet and 90-day plan](https://thepatientfunnel.com/en/#use-the-book)',
    ],
  },
  {
    subject: 'The full book, and how to use it',
    body: [
      'The free edition lets you try the approach in Arrival and Waiting. The full book helps you work through the entire patient journey, from Awareness to Referral.',
      'It includes the ten stages in detail, practical checklists and conversations, the 30-point audit, the weekly numbers sheet and a plan for the first 90 days. Choose a weak stage, try one action, then review it with your team.',
      'PDF + EPUB, about 43,000 words. $297, with a 30-day, no-questions-asked refund through Gumroad.',
      '[Get the full book · $297](https://sodanstjrwns.gumroad.com/l/patientfunnel-en)',
      'If the free edition has not helped you find a useful change yet, start there. It is yours to keep. If you are unsure whether the full book fits your practice, reply with the stage you want to improve.',
    ],
  },
  {
    // day 15 — the one time-limited price; skipped while no offer is configured
    offer: true,
    subject: 'A reader price, until {{offer_expires}}',
    body: [
      'A week ago I sent the plain offer. This is the only time I will add anything to it.',
      'Readers of the free edition can get the full book for {{offer_price}} instead of $297, with the code {{offer_code}} at checkout, until {{offer_expires}}. Same book, same thirty-day refund.',
      'This reader code is valid until the date above. The checkout shows the final price before you pay.',
      '[Use the code · {{offer_price}}]({{offer_url}})',
      'If you have already decided it is not for you, ignore this and keep the free edition.',
    ],
  },
  {
    // day 29 — column
    subject: 'Stop before you buy more new patients',
    body: [
      'The most common question I get from an owner is some version of "how do I get more new patients?" It is a reasonable question. It is also, in most practices, the wrong first question.',
      'There are exactly two ways a practice grows. You put more patients into the top of the funnel, or you lose fewer of them on the way down. Every vendor you will ever meet sells the first one, because it is the one they can invoice. Nobody sells the second one, because it lives inside your building and only you can do it.',
      'I wrote the rest of this down as a column. Five minutes.',
      '[Read the column](https://thepatientfunnel.com/en/columns/stop-before-you-buy-more-patients/)',
    ],
  },
  {
    // day 43 — column
    subject: '"It\'s expensive" is not about the price',
    body: [
      'Every coordinator I have ever trained came to me with the same complaint in the first month. "They say it\'s too expensive." And every one of them wanted the same fix: permission to discount.',
      'When a patient says "it\'s expensive," they are almost never comparing your fee to another practice\'s fee. They are comparing your fee to the value they currently feel. The sentence is not a statement about your price. It is a report on how the last twenty minutes went.',
      'The column walks through what we changed in the consultation instead of the fee.',
      '[Read the column](https://thepatientfunnel.com/en/columns/expensive-is-not-about-price/)',
    ],
  },
  {
    // day 57 — column
    subject: '"We do everything well" is remembered as nothing',
    body: [
      'Ask an owner what their practice is known for and you will usually get a list. Implants, ortho, cosmetic, family, gentle, modern, affordable. Now ask one of their patients the same question. You get silence, or "it\'s close to my house."',
      'That gap is the whole problem with referrals. A patient can only refer what they can describe. If your practice is "good at everything," the sentence they would need to say to a friend does not exist, so they say nothing.',
      'The column is about picking the one sentence, and what it cost us to pick it.',
      '[Read the column](https://thepatientfunnel.com/en/columns/we-do-everything-well/)',
    ],
  },
  {
    // day 71 — column
    subject: 'The phone is where bookings leak',
    body: [
      "Do you know how many calls your practice took this morning, and how many became a booking? Most owners cannot answer the first question. Divide last month's marketing spend by the number of new-patient calls and each call is worth tens of dollars, in some practices hundreds. The person answering it is usually the least trained person in the building.",
      '"How much is an implant?" is the king of incoming calls, and "it depends, you\'d have to come in" is the honest sentence that ends it. The caller did not ask about price. They asked for a signal that you are the right place.',
      'The column has the four sentence structures we use instead, and the fifteen-minute routine that keeps them alive when the desk changes staff.',
      '[Read the column](https://thepatientfunnel.com/en/columns/the-phone-is-where-bookings-leak/)',
    ],
  },
  {
    // day 85 — column
    subject: "No-shows are not the patient's fault",
    body: [
      'Reminder texts fix forgetting. Most no-shows are not forgetting; they are a mind that quietly tilted toward not going, and the reminder revived the memory without reviving the reason.',
      "A time the practice assigned is the practice's promise. A time the patient chose is the patient's promise. Only the second one gets kept. Three sentences at the desk move the ownership of the appointment to the patient, and they cost nothing.",
      'The column has the script, and the one line most desks say that teaches patients to no-show.',
      '[Read the column](https://thepatientfunnel.com/en/columns/no-shows-are-not-the-patients-fault/)',
    ],
  },
];

/** Post-purchase: sent to buyers of the book, days 3 and 14 after the sale. */
export const EN_PURCHASE_LAYOUT: LayoutStrings = {
  ...EN_LAYOUT,
  why: 'You are getting this because you bought Patient Funnel. Two short notes only; you can stop them below.',
};

export const EN_PURCHASE_EMAILS: LeadEmail[] = [
  {
    subject: 'How to read Patient Funnel',
    body: [
      'Thank you for buying the book. One request before you read it: do not read it front to back.',
      'Open Appendix A, the Ten-Stage Leak Audit, and score your practice first. Ten minutes. Then take the stage with the lowest score and read only that section of Chapter 4 this week. Do one thing from its checklist before you read the next stage. A stage fixed is worth more than the whole book skimmed.',
      'Second, Appendix B, the weekly numbers sheet. Fill it in once this Friday. The numbers you find you do not have are the finding; most practices cannot fill in half of it, and that is where the leaks hide.',
      'Third, Appendix C, the first ninety days. It is in order on purpose. Resist the urge to start with Awareness because it is the exciting one; it is also the expensive one.',
      'If something in the book does not match how things work in your country, reply to this email and tell me. I read every reply, and the next edition is built from them.',
    ],
  },
  {
    subject: 'Two weeks in: which stage needs attention next?',
    body: [
      'How did your first change go? Reply with the stage, what you tried and what you observed. Please leave out patient names and identifying details.',
      'If your next priority is Awareness, Appendix D introduces Patient Signal, a tool my team builds to measure whether AI assistants mention a clinic and which sources they use. I have a commercial interest in it; you can apply the book without it.',
      'Today it serves the Korean market. The international version is in development. If AI visibility is relevant to your practice, you can reply with your practice name, city and website to ask about a manual check. This is an optional next step, not a subscription included with the book.',
      'If a different stage needs work first, stay with that stage. Use the weekly numbers sheet to review the change before adding another project.',
    ],
  },
];
