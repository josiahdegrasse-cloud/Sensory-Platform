import { detectFoodType, getFoodTypeProfile } from '../../lib/food-intelligence';
import { filterAssignablePanelists, type AssignablePanelist } from '../../lib/assignments';
import type { ConceptDraft, Question } from './types';

const USAGE_OPTIONS: Record<string, string[]> = {
  cheese: ['Sandwiches or wraps', 'Cooking or melting', 'Topping meals', 'Snacking', 'Cheese boards or entertaining', 'Family meals'],
  bread: ['Breakfast', 'Sandwiches', 'Alongside a meal', 'Snacking', 'Entertaining', 'Cooking or recipes'],
  meat: ['Weeknight meals', 'Barbecues', 'Sandwiches or wraps', 'Meal preparation', 'Entertaining', 'On-the-go meals'],
  yogurt: ['Breakfast', 'Snacking', 'Dessert', 'On the go', 'With fruit or cereal', 'Cooking or recipes'],
  beverage: ['With meals', 'On the go', 'Social occasions', 'After exercise', 'At work', 'Relaxing at home'],
  snack: ['Between meals', 'On the go', 'Lunchboxes', 'Sharing', 'Entertaining', 'Evening treat'],
  sauce: ['Cooking', 'Dipping', 'As a topping', 'Marinating', 'Sandwiches or wraps', 'Entertaining'],
  chocolate: ['Personal treat', 'Sharing', 'Gifting', 'Dessert', 'With a hot drink', 'Special occasions'],
  generic: ['Everyday meals', 'Snacking', 'On the go', 'Cooking', 'Entertaining', 'Special occasions'],
};

function titleCase(value: string) {
  return value.replace(/[-_]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function uniqueOptions(values: string[], limit = 7) {
  return [...new Map(values.filter(Boolean).map(value => [value.toLowerCase(), value])).values()].slice(0, limit);
}

export function publicConceptName(draft: Pick<ConceptDraft, 'name'>) {
  return draft.name.trim() || 'this product';
}

export function buildTailoredConceptQuestions(draft: ConceptDraft): Question[] {
  const detection = detectFoodType(draft.category, draft.name, draft.description);
  const profile = getFoodTypeProfile(detection.slug);
  const productName = publicConceptName(draft);
  const categoryLabel = draft.category.trim() || detection.label;
  const categorySlug = profile.parentSlug ?? profile.slug;
  const validImages = draft.marketingImages.filter(url => url.trim());
  const benefits = draft.keyBenefits
    .split(/[,\n]+/)
    .map(part => part.trim())
    .filter(part => Boolean(part) && part.length <= 40 && !/\d/.test(part))
    .slice(0, 2);
  const cueOptions = [
    ...uniqueOptions([
    ...profile.successMarkers.slice(0, 5).map(titleCase),
    ...benefits,
    'Natural',
    'Premium',
    'Versatile',
    ], 7),
    'None of these',
  ];
  const usageOptions = uniqueOptions([
    draft.targetOccasion.trim(),
    ...(USAGE_OPTIONS[categorySlug] ?? USAGE_OPTIONS.generic),
  ], 6);
  const packageDescription = draft.packageFormat.trim() || draft.variantDimensions.packagingFormat?.trim() || '';
  const hasConcretePrice = Boolean(draft.pricePoint.trim() && packageDescription);

  const tailored: Question[] = [
    { id: 'q_tailored_appeal_1', text: `How appealing is the ${productName} concept overall?`, type: 'scale', required: true, category: 'appeal' },
    { id: 'q_tailored_clarity', text: `How clear is it from the concept and visuals what ${productName} is?`, type: 'scale', required: true, category: 'appeal' },
    { id: 'q_tailored_believable', text: `How believable does ${productName} feel based on the concept and visuals?`, type: 'scale', required: true, category: 'appeal' },
    ...validImages.map((_, index) => ({
      id: `q_tailored_image_appetite_${index}`,
      text: `How appetising does visual ${index + 1} make ${productName} look?`,
      type: 'scale' as const,
      imageIndex: index,
      required: true,
      category: 'appeal' as const,
    })),
    ...(validImages.length > 1 ? [
      { id: 'q_tailored_image_best', text: `Which ${productName} visual is most appealing to you?`, type: 'image_choice' as const, required: true, category: 'appeal' as const },
      { id: 'q_tailored_image_why', text: 'What made you choose that visual?', type: 'open_text' as const, required: false, category: 'appeal' as const },
    ] : validImages.length === 1 ? [
      { id: 'q_tailored_image_why', text: 'What works well or poorly in this visual?', type: 'open_text' as const, required: false, category: 'appeal' as const },
    ] : []),
    {
      id: 'q_tailored_visual_cues',
      text: 'Which qualities do the visuals communicate? (select all that apply)',
      type: 'multiple_choice',
      options: cueOptions,
      required: true,
      category: 'attributes',
    },
    { id: 'q_tailored_fit_1', text: `How well does this concept fit the ${categoryLabel.toLowerCase()} category?`, type: 'scale', required: true, category: 'attributes' },
    {
      id: 'q_tailored_usage_1',
      text: `In which situations would you most likely use ${productName}? (select all that apply)`,
      type: 'multiple_choice',
      options: usageOptions,
      required: true,
      category: 'usage',
    },
    {
      id: 'q_tailored_purchase_1',
      text: `How likely would you be to buy ${productName} if it tasted as described?`,
      type: 'multiple_choice',
      options: ['Definitely would buy', 'Probably would buy', 'Might or might not buy', 'Probably would not buy', 'Definitely would not buy'],
      required: true,
      category: 'purchase',
    },
    { id: 'q_tailored_barrier', text: `What, if anything, would discourage you from buying ${productName}?`, type: 'open_text', required: false, category: 'purchase' },
    ...(hasConcretePrice ? [{
      id: 'q_tailored_price_1',
      text: `How acceptable is ${draft.pricePoint.trim()} for ${packageDescription}?`,
      type: 'scale' as const,
      required: false,
      category: 'price' as const,
    }] : []),
  ];

  return tailored;
}

export function defaultConceptPanelistIds(panelists: AssignablePanelist[]) {
  return filterAssignablePanelists(panelists).map(panelist => panelist.id);
}

export function preferredConceptImageIndex(
  imageMeta: Array<{ reviewStatus: string }> | undefined,
  imageCount: number,
) {
  if (imageCount === 0) return 0;
  const approved = imageMeta?.findIndex(image => image.reviewStatus === 'approved') ?? -1;
  if (approved >= 0) return approved;
  const selected = imageMeta?.findIndex(image => image.reviewStatus === 'selected') ?? -1;
  return selected >= 0 ? selected : 0;
}
