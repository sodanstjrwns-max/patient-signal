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
    subject: 'Your free edition of Patient Funnel',
    body: [
      'Here is the free edition, 24 pages. The model and the two levers of growth, then two of the ten stages exactly as the book treats them, Arrival and Waiting, and at the back a thirty-line audit of your own practice.',
      '{{download}}',
      'If you read one thing in it today, make it section 2.4: widening the funnel versus increasing the input. Then, when you have ten minutes, score the audit at the back before you read anything else about your practice.',
      "There are only two ways to grow a practice's revenue. You can put more people into the funnel, which means spending more on marketing. Or you can stop the people already in it from falling out, which means fixing your own processes.",
      'Almost everyone picks the first one, because the second is tedious. But pour more volume into a funnel that already leaks and the experience gets worse, not better. More patients arrive than the practice can handle, satisfaction drops, and referrals drop with it. You end up paying more for each new patient every year.',
      "The book's position is blunt: if your annual revenue is under about $8 million, fix the funnel first. Marketing is the salt on a steak. The steak has to be good.",
      "Over the next week I'll send four more notes, one idea each, all of it from what we actually run in my clinic.",
    ],
  },
  {
    subject: 'The two stages you have never seen',
    body: [
      'You have never arrived at your own practice as a patient. You park in your own spot, come in through the back, and you have never once sat in your own waiting room with nothing to do.',
      'Which is why Arrival and Waiting are the two stages nobody audits. They cost almost nothing to fix, because they run on information and on people rather than on equipment.',
      'Start with parking. A patient who cannot find the lot, or finds it full with no idea what to do next, can give up before ever meeting you. Where to park, what to do when the lot is full, whether a large vehicle fits, how long the walk is: most booked patients are sent none of this, and every one of those gaps is a patient you lose without ever knowing their name.',
      'Then the waiting room. Waiting is the one stage where the patient is not yet committed to anything and can still stand up and walk out without being seen. Everything you spent to get them there is gone at that moment, and it does not show up in any report.',
      'Try it once this week. Drive in the way a patient does, park where they park, then sit in your own waiting room for twenty minutes with your phone in your pocket. Most owners find two or three things in that twenty minutes that they can fix the same day.',
      'Both stages are in your free edition in full, sections 4.4 and 4.5: what my practice sends before a visit, and what we do with the waiting room. Read them before you drive in.',
    ],
  },
  {
    subject: 'Pick one fight',
    body: [
      'Ask most owners what their practice is good at and you get a list. Implants, orthodontics, sedation, kids, same-day crowns. Everything.',
      'A practice that is good at everything is remembered for nothing. Patients do not choose from a list of strengths. They arrive with one problem, and they choose whoever looks most like the answer to it.',
      'So the work is to pick one. Which pain do you want to own in your city? Not the one with the best margin, and not the one you happen to like. The one your practice is genuinely better at solving than the practice down the road, and the one enough patients actually have.',
      'Once you have picked it, everything else gets easier, because you finally have a filter. Your ads say one thing. Your consultation says one thing. Your team can repeat it without being trained to.',
      'Chapter 3 of the book walks through how to find that pain point when it is not obvious, and what to do when the honest answer is that you are not yet better at anything.',
    ],
  },
  {
    subject: 'Where the money actually leaks',
    body: [
      'If I could look at one stage in your practice, it would be Consultation.',
      'Awareness and Booking cost money to improve. Consultation costs almost nothing, and it is where the largest sums quietly disappear. A patient who trusts the diagnosis but does not understand the plan says "let me think about it," and you never learn which of the two it was.',
      'The second place I would look is Referral, for the opposite reason. Take two practices that each see a hundred patients. One turns forty of them into referrals, the other twenty. After one cycle the first has twice the new patients. After two cycles, four times. That gap compounds quietly, year after year, and no marketing budget catches up with it.',
      'Both stages are run by people, not by spend. Which is why they are fixable this month rather than next year.',
      'The book gives each of the ten stages the same treatment: what leaks, why, and the checklists, scripts, and forms my own practice uses.',
    ],
  },
  {
    subject: 'The full book',
    body: [
      'This is the last note in the series, so here is the offer plainly.',
      'Patient Funnel: How Patients Find, Choose, and Refer Your Practice is the whole system. The ten stages a patient moves through, where they leak at each one, and what to do about it. It is the method I used to build the largest dental practice in central South Korea, running at about US$9M a year.',
      'Inside: the two levers of growth and which one to pull first; how to find the one pain point your practice should own; Chapter 4, the core, covering all ten stages in detail with the checklists, consultation scripts, and forms we use; and how to read your own numbers, from leakage to compound growth to seasonality.',
      'PDF and EPUB, about 41,000 words. $297. Thirty-day refund, no questions, so the risk of finding out is zero.',
      '[Get the full book · $297](https://sodanstjrwns.gumroad.com/l/patientfunnel-en)',
      'If it is not for you, that is fine. The free edition is yours to keep.',
    ],
  },
  {
    // day 15 — the one time-limited price; skipped while no offer is configured
    offer: true,
    subject: 'A reader price, until {{offer_expires}}',
    body: [
      'A week ago I sent the plain offer. This is the only time I will add anything to it.',
      'Readers of the free edition can get the full book for {{offer_price}} instead of $297, with the code {{offer_code}} at checkout, until {{offer_expires}}. Same book, same thirty-day refund.',
      'After that date the code stops working and the price is $297 again. I do not run rolling discounts, so there is no better moment coming.',
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
    subject: 'Does AI recommend your practice?',
    body: [
      'Two weeks in, so a note about Stage 1, Awareness, because it has changed under our feet.',
      'Patients used to search and read ten results. Now a growing share ask ChatGPT, Gemini or Perplexity "who is a good dentist near me for implants" and read one answer. Either your practice is in that answer or it is not, and nothing in your analytics tells you which.',
      'Patient Signal is the tool my company built to measure exactly that: how often each AI names a clinic when patients ask, and which sources it is citing when it does. Appendix D of the book describes it. Today it runs on the Korean market.',
      'For practices outside Korea I am running the check by hand while the international version is built. Reply to this email with your practice name, city and website, and I will send you what the three engines say about you and who they name instead. It is free and there is no pitch attached; I want to see what the answers look like in your market as much as you do.',
    ],
  },
];
