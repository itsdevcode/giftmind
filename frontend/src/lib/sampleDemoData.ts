import type { Recipient, GiftProject, RecommendationGeneration, StoryKeepsake } from "@/lib/api";

export interface SampleDemoData {
  recipient: Recipient;
  project: GiftProject;
  generation: RecommendationGeneration;
  memories: Record<string, string>;
  story: StoryKeepsake;
}

export const SAMPLE_DEMO_DATA: SampleDemoData = {
  recipient: {
    id: "demo-recipient-maya",
    user_id: "demo-user",
    name: "Maya Lin",
    relationship: "Sister",
    interests: ["Specialty Pour-Over Coffee", "Analog Photography", "Trail Running"],
    notes: "Loves thoughtful handwritten notes, exploring local roasters, and minimalist design.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  project: {
    id: "demo-project-birthday",
    recipient_id: "demo-recipient-maya",
    title: "Maya's 30th Birthday Keepsake",
    occasion: "30th Birthday",
    occasion_date: "2026-11-20",
    budget_min: 40,
    budget_max: 120,
    currency: "USD",
    status: "in_progress",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  generation: {
    id: "demo-gen-1",
    gift_project_id: "demo-project-birthday",
    user_id: "demo-user",
    provider: "google",
    model: "gemma-4-26b-a4b-it",
    prompt_version: "v1",
    status: "succeeded",
    error_message: null,
    created_at: new Date().toISOString(),
    recommendations: [
      {
        id: "rec-1",
        gift_project_id: "demo-project-birthday",
        generation_id: "demo-gen-1",
        title: "Artisanal Ceramic Pour-Over Dripper & Single-Origin Roast",
        description: "Handcrafted matte ceramic coffee dripper paired with locally roasted Ethiopian whole-bean coffee.",
        category: "Beverage & Living",
        estimated_budget: "65.00",
        currency: "USD",
        personalization_reason: "Honors her morning pour-over ritual and deep appreciation for tactile craftsmanship.",
        presentation_idea: "Wrap in natural linen ribbon with a small packet of whole beans and a brew note.",
        created_at: new Date().toISOString(),
      },
      {
        id: "rec-2",
        gift_project_id: "demo-project-birthday",
        generation_id: "demo-gen-1",
        title: "Vintage Leather 35mm Film Roll Travel Case & Kodak Portra 400",
        description: "Sturdy stitched leather pouch holding up to four rolls of 35mm film safely during excursions.",
        category: "Creative & Travel",
        estimated_budget: "48.00",
        currency: "USD",
        personalization_reason: "Directly complements her analog film photography adventures and weekend outings.",
        presentation_idea: "Include a blank roll labeled 'Chapter 30' ready for her first roll of the new decade.",
        created_at: new Date().toISOString(),
      },
      {
        id: "rec-3",
        gift_project_id: "demo-project-birthday",
        generation_id: "demo-gen-1",
        title: "Reflective Trail Running Vest & Hydration Flasks",
        description: "Ultralight, breathable running pack engineered for ergonomic trail stability and twilight visibility.",
        category: "Outdoors & Wellness",
        estimated_budget: "85.00",
        currency: "USD",
        personalization_reason: "Supports her endurance goals and trail running safety on backcountry paths.",
        presentation_idea: "Slip an encouraging route map inside one of the front flask pockets.",
        created_at: new Date().toISOString(),
      },
    ],
  },
  memories: {
    how_we_met: "We grew up in the same house in Portland, spending long summers inventing treasure hunts and climbing the cedar trees behind our backyard.",
    favorite_memory: "Hiking up Mount Hood at dawn last October, brewing pour-over coffee on a tiny camp stove right as the sunlight hit the glacier ridge.",
    what_makes_them_special: "Her quiet resilience, her genuine curiosity about people's backstories, and her eye for catching golden-hour light through her camera lens.",
    shared_milestone: "Navigating our big family moves across the country together, always keeping each other grounded no matter how chaotic things became.",
    gift_feeling: "Deeply appreciated, recognized for who she is, and excited for all the trail adventures the next decade will bring.",
  },
  story: {
    id: "demo-story-1",
    gift_project_id: "demo-project-birthday",
    user_id: "demo-user",
    title: "Light on the Ridge: Celebrating Thirty Years with Maya",
    dedication: "For Maya — Sister, trail companion, and artist of the everyday.",
    story_body: "Some people move through the world in a rush, but Maya has always been someone who notices the quiet frames. Growing up together beneath the towering cedar trees of Portland, she was the one who taught me how to pause. Where others saw mundane afternoons, she discovered light filtering through branches, or the exact right note in a freshly grounded cup of morning coffee.\n\nThere is a morning on Mount Hood that stays with me like an anchor. The trail was quiet and frost still rimmed the pines. At the summit, shivering and laughing against the wind, Maya unzipped her pack, pulled out a small camp kettle, and methodically brewed two pour-over coffees as the sunrise painted the valley gold. It was classic Maya: patient, deliberate, transforming an ordinary moment into something unforgettable.\n\nNow, standing on the threshold of thirty, that same quiet tenacity defines everything she touches. Whether she is logging miles on remote ridge trails or capturing fleeting expressions on 35mm film, she brings kindness, depth, and unwavering loyalty to everyone around her. Maya, you have always illuminated the path for those fortunate enough to walk alongside you.",
    closing_message: "May your thirtieth year be filled with clear morning trails, rich cups of coffee, and light in every frame. Happy Birthday, Maya.",
    model_name: "gemma-4-26b-a4b-it",
    prompt_version: "v1",
    status: "succeeded",
    error_message: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};
