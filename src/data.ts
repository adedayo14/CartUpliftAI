export type Product = {
  id: string;
  title: string;
  category: string;
  brand: string;
  price: number;
  tags?: string[];
};

export const allProducts: Product[] = [
  {
    id: "product_1",
    title: "Wireless Headphones",
    category: "Electronics",
    brand: "TechBrand",
    price: 99.99,
    tags: ["wireless", "audio", "bluetooth", "music"],
  },
  {
    id: "product_2",
    title: "Bluetooth Speaker",
    category: "Electronics",
    brand: "SoundCorp",
    price: 79.99,
    tags: ["wireless", "audio", "bluetooth", "portable"],
  },
  {
    id: "product_3",
    title: "Running Shoes",
    category: "Sports",
    brand: "SportsCo",
    price: 129.99,
    tags: ["athletic", "running", "footwear", "comfort"],
  },
  {
    id: "product_4",
    title: "Yoga Mat",
    category: "Sports",
    brand: "FitnessPro",
    price: 29.99,
    tags: ["yoga", "exercise", "fitness", "mat"],
  },
  {
    id: "product_5",
    title: "Coffee Maker",
    category: "Kitchen",
    brand: "BrewMaster",
    price: 159.99,
    tags: ["coffee", "kitchen", "appliance", "brewing"],
  },
];

export async function getAllProducts(): Promise<Product[]> {
  return allProducts;
}

export async function getProductsData(ids: string[]): Promise<Product[]> {
  const set = new Set(ids);
  return allProducts.filter((p) => set.has(p.id));
}
