import { Nutrition } from "./game";

export interface Food extends Nutrition {
  id: string;
  name: string;
  cat: "meat" | "fish" | "dairy" | "eggs" | "legumes" | "grains" | "nuts" | "veg" | "fruit" | "other";
  portion?: number; // типова порція, г
  portionLabel?: string;
}

/** Усереднені значення на 100 г (готовий / сирий стан вказано в назві). */
export const FOODS: Food[] = [
  // М'ясо
  { id: "chicken-breast", name: "Куряче філе (варене)", cat: "meat", kcal: 153, protein: 31, fat: 3.6, carbs: 0, portion: 150 },
  { id: "chicken-thigh", name: "Куряче стегно (запечене)", cat: "meat", kcal: 209, protein: 26, fat: 11, carbs: 0, portion: 150 },
  { id: "turkey", name: "Індичка філе (варена)", cat: "meat", kcal: 135, protein: 29, fat: 1.7, carbs: 0, portion: 150 },
  { id: "beef-lean", name: "Яловичина пісна (тушкована)", cat: "meat", kcal: 217, protein: 30, fat: 10, carbs: 0, portion: 150 },
  { id: "pork-loin", name: "Свинина корейка (запечена)", cat: "meat", kcal: 242, protein: 27, fat: 14, carbs: 0, portion: 150 },
  { id: "ground-beef", name: "Фарш яловичий (смажений)", cat: "meat", kcal: 250, protein: 26, fat: 15, carbs: 0, portion: 120 },
  { id: "ham", name: "Шинка", cat: "meat", kcal: 145, protein: 21, fat: 6, carbs: 1.5, portion: 50 },
  { id: "liver", name: "Печінка куряча (тушкована)", cat: "meat", kcal: 167, protein: 24, fat: 6.5, carbs: 0.9, portion: 120 },
  // Риба
  { id: "tuna-can", name: "Тунець консервований у власному соку", cat: "fish", kcal: 116, protein: 26, fat: 1, carbs: 0, portion: 120, portionLabel: "банка" },
  { id: "salmon", name: "Лосось (запечений)", cat: "fish", kcal: 206, protein: 22, fat: 13, carbs: 0, portion: 150 },
  { id: "hake", name: "Хек (варений)", cat: "fish", kcal: 95, protein: 19, fat: 2, carbs: 0, portion: 150 },
  { id: "mackerel", name: "Скумбрія (запечена)", cat: "fish", kcal: 239, protein: 21, fat: 17, carbs: 0, portion: 120 },
  { id: "shrimp", name: "Креветки (варені)", cat: "fish", kcal: 99, protein: 24, fat: 0.3, carbs: 0.2, portion: 100 },
  { id: "herring", name: "Оселедець слабосолений", cat: "fish", kcal: 217, protein: 18, fat: 15.5, carbs: 0, portion: 80 },
  // Яйця
  { id: "egg", name: "Яйце куряче", cat: "eggs", kcal: 155, protein: 12.6, fat: 10.6, carbs: 1.1, portion: 55, portionLabel: "1 шт" },
  { id: "egg-white", name: "Яєчний білок", cat: "eggs", kcal: 52, protein: 11, fat: 0.2, carbs: 0.7, portion: 33, portionLabel: "1 шт" },
  // Молочне
  { id: "cottage-5", name: "Сир кисломолочний 5%", cat: "dairy", kcal: 121, protein: 17, fat: 5, carbs: 1.8, portion: 200, portionLabel: "пачка" },
  { id: "cottage-0", name: "Сир кисломолочний 0%", cat: "dairy", kcal: 71, protein: 16.5, fat: 0.5, carbs: 1.3, portion: 200, portionLabel: "пачка" },
  { id: "greek-yogurt", name: "Грецький йогурт 2%", cat: "dairy", kcal: 73, protein: 10, fat: 2, carbs: 3.6, portion: 150 },
  { id: "kefir", name: "Кефір 2.5%", cat: "dairy", kcal: 53, protein: 2.9, fat: 2.5, carbs: 4, portion: 250, portionLabel: "склянка" },
  { id: "milk", name: "Молоко 2.5%", cat: "dairy", kcal: 52, protein: 2.8, fat: 2.5, carbs: 4.7, portion: 250, portionLabel: "склянка" },
  { id: "hard-cheese", name: "Сир твердий", cat: "dairy", kcal: 360, protein: 25, fat: 28, carbs: 0, portion: 30 },
  { id: "mozzarella", name: "Моцарела", cat: "dairy", kcal: 280, protein: 22, fat: 21, carbs: 2.2, portion: 60 },
  { id: "whey", name: "Протеїн сироватковий", cat: "dairy", kcal: 380, protein: 78, fat: 5, carbs: 7, portion: 30, portionLabel: "скуп" },
  // Бобові
  { id: "lentils", name: "Сочевиця (варена)", cat: "legumes", kcal: 116, protein: 9, fat: 0.4, carbs: 20, portion: 200 },
  { id: "chickpeas", name: "Нут (варений)", cat: "legumes", kcal: 164, protein: 8.9, fat: 2.6, carbs: 27, portion: 150 },
  { id: "beans", name: "Квасоля (варена)", cat: "legumes", kcal: 127, protein: 8.7, fat: 0.5, carbs: 23, portion: 150 },
  { id: "tofu", name: "Тофу", cat: "legumes", kcal: 144, protein: 15.6, fat: 8.7, carbs: 2.8, portion: 150 },
  { id: "peas", name: "Горох зелений", cat: "legumes", kcal: 81, protein: 5.4, fat: 0.4, carbs: 14, portion: 100 },
  // Злаки
  { id: "buckwheat", name: "Гречка (варена)", cat: "grains", kcal: 110, protein: 4.2, fat: 1.1, carbs: 21, portion: 200 },
  { id: "rice", name: "Рис білий (варений)", cat: "grains", kcal: 130, protein: 2.7, fat: 0.3, carbs: 28, portion: 200 },
  { id: "oats", name: "Вівсянка (суха)", cat: "grains", kcal: 370, protein: 13, fat: 6.5, carbs: 60, portion: 60 },
  { id: "pasta", name: "Макарони (варені)", cat: "grains", kcal: 158, protein: 5.8, fat: 0.9, carbs: 31, portion: 200 },
  { id: "bread-rye", name: "Хліб житній", cat: "grains", kcal: 250, protein: 8.5, fat: 3.3, carbs: 48, portion: 40, portionLabel: "скибка" },
  { id: "bread-white", name: "Хліб білий", cat: "grains", kcal: 265, protein: 9, fat: 3.2, carbs: 49, portion: 35, portionLabel: "скибка" },
  { id: "bulgur", name: "Булгур (варений)", cat: "grains", kcal: 83, protein: 3.1, fat: 0.2, carbs: 19, portion: 200 },
  { id: "potato", name: "Картопля (варена)", cat: "grains", kcal: 87, protein: 1.9, fat: 0.1, carbs: 20, portion: 200 },
  // Горіхи
  { id: "peanuts", name: "Арахіс", cat: "nuts", kcal: 567, protein: 26, fat: 49, carbs: 16, portion: 30, portionLabel: "жменя" },
  { id: "peanut-butter", name: "Арахісова паста", cat: "nuts", kcal: 588, protein: 25, fat: 50, carbs: 20, portion: 20, portionLabel: "ложка" },
  { id: "almonds", name: "Мигдаль", cat: "nuts", kcal: 579, protein: 21, fat: 50, carbs: 22, portion: 30, portionLabel: "жменя" },
  { id: "walnuts", name: "Волоські горіхи", cat: "nuts", kcal: 654, protein: 15, fat: 65, carbs: 14, portion: 30, portionLabel: "жменя" },
  { id: "pumpkin-seeds", name: "Гарбузове насіння", cat: "nuts", kcal: 559, protein: 30, fat: 49, carbs: 11, portion: 30, portionLabel: "жменя" },
  // Овочі / фрукти
  { id: "broccoli", name: "Броколі", cat: "veg", kcal: 34, protein: 2.8, fat: 0.4, carbs: 7, portion: 150 },
  { id: "salad", name: "Салат з овочів (без заправки)", cat: "veg", kcal: 25, protein: 1.2, fat: 0.2, carbs: 5, portion: 200 },
  { id: "banana", name: "Банан", cat: "fruit", kcal: 89, protein: 1.1, fat: 0.3, carbs: 23, portion: 120, portionLabel: "1 шт" },
  { id: "apple", name: "Яблуко", cat: "fruit", kcal: 52, protein: 0.3, fat: 0.2, carbs: 14, portion: 180, portionLabel: "1 шт" },
  // Інше
  { id: "borscht", name: "Борщ з м'ясом", cat: "other", kcal: 60, protein: 3.5, fat: 2.5, carbs: 6, portion: 350, portionLabel: "тарілка" },
  { id: "varenyky-potato", name: "Вареники з картоплею", cat: "other", kcal: 200, protein: 5, fat: 4.5, carbs: 35, portion: 250, portionLabel: "порція" },
  { id: "varenyky-cheese", name: "Вареники з сиром", cat: "other", kcal: 215, protein: 11, fat: 5, carbs: 31, portion: 250, portionLabel: "порція" },
  { id: "syrnyky", name: "Сирники", cat: "other", kcal: 220, protein: 15, fat: 9, carbs: 20, portion: 150, portionLabel: "3 шт" },
  { id: "olive-oil", name: "Олія оливкова", cat: "other", kcal: 884, protein: 0, fat: 100, carbs: 0, portion: 10, portionLabel: "ложка" },
];

export const CAT_LABEL: Record<Food["cat"], string> = {
  meat: "М'ясо", fish: "Риба", dairy: "Молочне", eggs: "Яйця", legumes: "Бобові",
  grains: "Крупи", nuts: "Горіхи", veg: "Овочі", fruit: "Фрукти", other: "Інше",
};

/** Перераховує цінність на 100 г у порцію. */
export const scale = (n: Nutrition, grams: number): Nutrition => {
  const k = grams / 100;
  const r = (x: number) => Math.round(x * k * 10) / 10;
  return { kcal: Math.round(n.kcal * k), protein: r(n.protein), fat: r(n.fat), carbs: r(n.carbs) };
};

/** Білкова щільність: г білка на 100 ккал — щоб підсвічувати «найкращі» джерела. */
export const proteinDensity = (n: Nutrition) => (n.kcal > 0 ? (n.protein * 100) / n.kcal : 0);
