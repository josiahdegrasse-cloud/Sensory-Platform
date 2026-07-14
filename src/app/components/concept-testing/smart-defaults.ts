import { detectFoodType, getFoodTypeProfile } from '../../lib/food-intelligence';
import { filterAssignablePanelists, type AssignablePanelist } from '../../lib/assignments';
import type { ConceptDraft, Question } from './types';
import { AI_QUESTION_TEMPLATES as QUESTION_TEMPLATES } from './questions-data';
import { selectBalancedQuestions } from './survey-utils';

export function publicConceptName(draft: Pick<ConceptDraft, 'name'>) {
  return draft.name.trim() || 'this product';
}

export function buildTailoredConceptQuestions(draft: ConceptDraft): Question[] {
  const detection = detectFoodType(draft.category, draft.name, draft.description);
  const profile = getFoodTypeProfile(detection.slug);
  const productName = publicConceptName(draft);
  const category = draft.category.trim() || detection.label.toLowerCase();
  const benefits = draft.keyBenefits
    .split(/[,\n]+/)
    .map(part => part.trim())
    .filter(Boolean)
    .slice(0, 4);
  const successMarkers = profile.successMarkers.slice(0, 5);
  const riskMarkers = profile.riskMarkers.slice(0, 4);

  const tailored: Question[] = [
    { id: 'q_tailored_appeal_1', text: `How appealing is the ${productName} concept overall?`, type: 'scale', required: true, category: 'appeal' },
    { id: 'q_tailored_appeal_2', text: `How interested would you be in trying this ${category}?`, type: 'scale', required: true, category: 'appeal' },
    { id: 'q_tailored_uniqueness', text: 'How different does this concept feel from products you already see in stores?', type: 'scale', required: true, category: 'appeal' },
    { id: 'q_tailored_believable', text: `How believable does ${productName} feel based on the concept and visuals?`, type: 'scale', required: true, category: 'appeal' },
    { id: 'q_tailored_purchase_1', text: `How likely would you be to buy ${productName} if it tasted as described?`, type: 'scale', required: true, category: 'purchase' },
    { id: 'q_tailored_purchase_2', text: 'Where would you most expect to buy this product?', type: 'multiple_choice', options: ['Grocery store', 'Club store', 'Specialty store', 'Online', 'Restaurant or foodservice'], required: false, category: 'purchase' },
    { id: 'q_tailored_price_1', text: draft.pricePoint ? `How acceptable is the expected price of ${draft.pricePoint}?` : 'How important would price be in your decision to buy this product?', type: 'scale', required: true, category: 'price' },
    { id: 'q_tailored_price_2', text: 'What would make the product feel worth paying more for?', type: 'open_text', required: false, category: 'price' },
    { id: 'q_tailored_usage_1', text: 'How often could you imagine using or eating this product?', type: 'scale', required: true, category: 'usage' },
    { id: 'q_tailored_usage_2', text: 'Which occasion best fits this product?', type: 'multiple_choice', options: ['Everyday meals', 'Snacking', 'Entertaining', 'Fitness or nutrition', 'Family meals', 'Special treat'], required: false, category: 'usage' },
    { id: 'q_tailored_image_best', text: `Which ${productName} visual is most appealing to you?`, type: 'image_choice', required: draft.marketingImages.filter(u => u.trim()).length > 1, category: 'appeal' },
    { id: 'q_tailored_image_why', text: 'What made that visual stand out to you?', type: 'open_text', required: false, category: 'appeal' },
    { id: 'q_tailored_fit_1', text: `How well does this concept fit the ${detection.label.toLowerCase()} category?`, type: 'scale', required: true, category: 'attributes' },
    ...successMarkers.map((marker, index) => ({
      id: `q_tailored_success_${index}`,
      text: `How important is "${marker}" for this type of product?`,
      type: 'scale' as const,
      required: false,
      category: 'attributes' as const,
    })),
    ...riskMarkers.map((marker, index) => ({
      id: `q_tailored_risk_${index}`,
      text: `How concerned would you be if this product had a "${marker}" note?`,
      type: 'scale' as const,
      required: false,
      category: 'attributes' as const,
    })),
    ...benefits.map((benefit, index) => ({
      id: `q_tailored_benefit_${index}`,
      text: `How motivating is this benefit: ${benefit}?`,
      type: 'scale' as const,
      required: false,
      category: 'purchase' as const,
    })),
    { id: 'q_tailored_demographic_1', text: 'Which statement best describes you?', type: 'multiple_choice', options: ['I regularly buy this category', 'I occasionally buy this category', 'I rarely buy this category', 'I avoid this category'], required: false, category: 'demographics' },
    { id: 'q_tailored_open_1', text: 'What is the strongest reason you would buy this product?', type: 'open_text', required: false, category: 'attributes' },
    { id: 'q_tailored_open_2', text: 'What would make you hesitate to buy this product?', type: 'open_text', required: false, category: 'attributes' },
    { id: 'q_tailored_open_3', text: 'What would you change to make this concept stronger?', type: 'open_text', required: false, category: 'attributes' },
  ];

  return selectBalancedQuestions(tailored, QUESTION_TEMPLATES);
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
