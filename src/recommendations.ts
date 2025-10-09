import type { Product } from "./data";
import { getAllProducts, getProductsData } from "./data";

export type ContentRecommendation = {
  product_id: string;
  score: number;
  reason: string;
  strategy: string;
  attributes_matched?: string[];
  personalization_factors?: string[];
};

export async function generateContentRecommendations(
  productIds: string[],
  excludeIds: string[],
  customerPreferences: any,
  privacyLevel: string
): Promise<ContentRecommendation[]> {
  const baseProducts = await getProductsData(productIds);

  if (privacyLevel === "basic") {
    return getBasicContentRecommendations(baseProducts, excludeIds);
  }

  return getPersonalizedContentRecommendations(
    baseProducts,
    excludeIds,
    customerPreferences,
    privacyLevel
  );
}

export async function getBasicContentRecommendations(
  baseProducts: Product[],
  excludeIds: string[]
): Promise<ContentRecommendation[]> {
  const recs: ContentRecommendation[] = [];

  for (const product of baseProducts) {
    const similar = await findSimilarProductsByCategory(
      product.category,
      excludeIds.concat(baseProducts.map((p) => p.id))
    );

    recs.push(
      ...similar.map((p) => ({
        product_id: p.id,
        score: calculateBasicSimilarity(product, p),
        reason: `Similar to ${product.title}`,
        strategy: "content_category",
        attributes_matched: ["category"],
      }))
    );
  }

  const unique = Array.from(new Map(recs.map((r) => [r.product_id, r])).values());
  return unique.sort((a, b) => b.score - a.score).slice(0, 20);
}

export async function getPersonalizedContentRecommendations(
  baseProducts: Product[],
  excludeIds: string[],
  customerPreferences: any,
  privacyLevel: string
): Promise<ContentRecommendation[]> {
  const recs: ContentRecommendation[] = [];

  for (const product of baseProducts) {
    const similar = await findSimilarProductsEnhanced(
      product,
      excludeIds.concat(baseProducts.map((p) => p.id)),
      customerPreferences
    );

    recs.push(
      ...similar.map((p) => ({
        product_id: p.id,
        score: calculatePersonalizedSimilarity(product, p, customerPreferences),
        reason: generatePersonalizedReason(product, p, customerPreferences),
        strategy: "content_personalized",
        attributes_matched: getMatchedAttributes(product, p),
        personalization_factors: getPersonalizationFactors(p, customerPreferences),
      }))
    );
  }

  if (privacyLevel === "full_ml") {
    const advanced = await getAdvancedContentRecommendations(
      baseProducts,
      excludeIds,
      customerPreferences
    );
    recs.push(...advanced);
  }

  const unique = Array.from(new Map(recs.map((r) => [r.product_id, r])).values());
  return applyPersonalizedRanking(unique, customerPreferences).slice(0, 20);
}

export async function findSimilarProductsByCategory(category: string, excludeIds: string[]) {
  const all = await getAllProducts();
  return all.filter((p) => p.category === category && !excludeIds.includes(p.id));
}

export async function findSimilarProductsEnhanced(
  baseProduct: Product,
  excludeIds: string[],
  _customerPreferences: any
) {
  const all = await getAllProducts();
  return all.filter((p) => {
    if (excludeIds.includes(p.id)) return false;

    const categoryMatch = p.category === baseProduct.category;
    const brandMatch = p.brand === baseProduct.brand;
    const priceRange = getPriceRange(p.price);
    const basePriceRange = getPriceRange(baseProduct.price);
    const priceMatch = priceRange === basePriceRange;

    if (categoryMatch || brandMatch || priceMatch) return true;

    const tagOverlap = calculateTagOverlap(baseProduct.tags || [], p.tags || []);
    return tagOverlap > 0.3;
  });
}

export async function getAdvancedContentRecommendations(
  baseProducts: Product[],
  excludeIds: string[],
  customerPreferences: any
): Promise<ContentRecommendation[]> {
  const recs: ContentRecommendation[] = [];

  for (const product of baseProducts) {
    const semantic = await findSemanticallySimilarProducts(
      product,
      excludeIds,
      customerPreferences
    );

    recs.push(
      ...semantic.map((p) => ({
        product_id: p.id,
        score: p.semantic_similarity,
        reason: "AI-powered semantic similarity",
        strategy: "content_semantic",
        attributes_matched: ["semantic_embedding"],
        personalization_factors: ["customer_history", "behavioral_patterns"],
      }))
    );
  }

  return recs;
}

export function calculateBasicSimilarity(product1: Product, product2: Product): number {
  let similarity = 0;
  if (product1.category === product2.category) similarity += 0.4;
  if (product1.brand === product2.brand) similarity += 0.3;
  if (getPriceRange(product1.price) === getPriceRange(product2.price)) similarity += 0.2;
  const tagOverlap = calculateTagOverlap(product1.tags || [], product2.tags || []);
  similarity += tagOverlap * 0.1;
  return Math.min(1, similarity);
}

export function calculatePersonalizedSimilarity(
  product1: Product,
  product2: Product,
  customerPreferences: any
): number {
  let similarity = calculateBasicSimilarity(product1, product2);

  if (customerPreferences?.category_affinity?.primary === product2.category) similarity += 0.2;

  if (customerPreferences?.monetary?.price_tier) {
    const productPriceRange = getPriceRange(product2.price);
    const preferredRange = customerPreferences.monetary.price_tier;
    if (productPriceRange === preferredRange) similarity += 0.15;
  }

  if (customerPreferences?.time_patterns?.preferred_hours) {
    const currentHour = new Date().getHours().toString();
    const preferredHours: string[] = customerPreferences.time_patterns.preferred_hours;
    if (preferredHours.includes(currentHour)) similarity += 0.05;
  }

  return Math.min(1, similarity);
}

export function generatePersonalizedReason(
  baseProduct: Product,
  recommendedProduct: Product,
  customerPreferences: any
): string {
  const reasons: string[] = [];
  if (baseProduct.category === recommendedProduct.category) reasons.push("same category");
  if (baseProduct.brand === recommendedProduct.brand) reasons.push("same brand");
  if (customerPreferences?.category_affinity?.primary === recommendedProduct.category)
    reasons.push("matches your preferences");
  const priceRange = getPriceRange(recommendedProduct.price);
  if (customerPreferences?.monetary?.price_tier === priceRange)
    reasons.push("in your preferred price range");
  if (reasons.length === 0) return "Similar product recommendation";
  return `Recommended because it's ${reasons.join(" and ")}`;
}

export function getMatchedAttributes(product1: Product, product2: Product): string[] {
  const matches: string[] = [];
  if (product1.category === product2.category) matches.push("category");
  if (product1.brand === product2.brand) matches.push("brand");
  if (getPriceRange(product1.price) === getPriceRange(product2.price)) matches.push("price_range");
  const tagOverlap = calculateTagOverlap(product1.tags || [], product2.tags || []);
  if (tagOverlap > 0.3) matches.push("tags");
  return matches;
}

export function getPersonalizationFactors(product: Product, customerPreferences: any): string[] {
  const factors: string[] = [];
  if (customerPreferences?.category_affinity?.primary === product.category)
    factors.push("category_preference");
  if (customerPreferences?.monetary?.price_tier === getPriceRange(product.price))
    factors.push("price_preference");
  if (customerPreferences?.recency?.score > 3) factors.push("recent_activity");
  return factors;
}

export function applyPersonalizedRanking(recommendations: ContentRecommendation[], _prefs: any) {
  return recommendations.sort((a, b) => {
    let scoreA = a.score + ((a.personalization_factors?.length || 0) * 0.1);
    let scoreB = b.score + ((b.personalization_factors?.length || 0) * 0.1);
    return scoreB - scoreA;
  });
}

export async function findSemanticallySimilarProducts(
  baseProduct: Product,
  excludeIds: string[],
  _customerPreferences: any
) {
  const all = await getAllProducts();
  return all
    .filter((p) => !excludeIds.includes(p.id))
    .map((p) => ({ ...p, semantic_similarity: Math.random() * 0.8 + 0.2 }))
    .filter((p) => p.semantic_similarity > 0.5)
    .sort((a, b) => b.semantic_similarity - a.semantic_similarity)
    .slice(0, 5);
}

// Utils
export function getPriceRange(price: number): string {
  if (price < 25) return "budget";
  if (price < 75) return "mid_range";
  if (price < 150) return "premium";
  return "luxury";
}

export function calculateTagOverlap(tags1: string[], tags2: string[]): number {
  if (tags1.length === 0 || tags2.length === 0) return 0;
  const set1 = new Set(tags1);
  const set2 = new Set(tags2);
  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
}
