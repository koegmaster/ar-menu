export type ModelStatus = "pending" | "processing" | "succeeded" | "failed";

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface Dish {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  price: number | null;
  glb_url: string | null;
  usdz_url: string | null;
  poster_url: string | null;
  meshy_task_id: string | null;
  model_status: ModelStatus;
  created_at: string;
}

export interface DishPhoto {
  id: string;
  dish_id: string;
  photo_url: string;
  sort_order: number;
  created_at: string;
}

export interface DishWithPhotos extends Dish {
  dish_photos: DishPhoto[];
}
