import type { LayoutStrings, LeadEmail } from './email.layout';

export const EN_LAYOUT: LayoutStrings = {
  htmlLang: 'en',
  fontFamily: "Georgia, 'Times New Roman', serif",
  signature: 'Suokjoon Moon',
  senderBlock:
    'Patient Funnel · Suokjoon Moon · 602 Yeongdong-daero, 6F z208, Gangnam-gu, Seoul 06083, Korea · patientsfunnel@gmail.com',
  why: 'You are getting this because you asked for the free preview of Patient Funnel at thepatientfunnel.com.',
  unsubscribe: 'Unsubscribe from these emails',
};

/** Step 1 is sent immediately; {{download}} is replaced with the PDF link. */
export const EN_EMAILS: LeadEmail[] = [
  {
    subject: 'Your free preview of Patient Funnel',
    body: [
      'Here is the preview. Chapter 1, the opening of Chapter 2, the full definition of the ten stages, and the two levers of growth. About nine pages.',
      '{{download}}',
      'If you read one thing in it today, make it section 2.4: widening the funnel versus increasing the input.',
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
      'Chapter 4 of the book takes both stages apart in detail, with what my practice sends before a visit and what we do with the waiting room.',
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
      'PDF and EPUB, about 41,000 words. $197. Thirty-day refund, no questions, so the risk of finding out is zero.',
      'https://sodanstjrwns.gumroad.com/l/patientfunnel-en',
      'If it is not for you, that is fine. The free check stays free and the preview is yours to keep.',
    ],
  },
];
