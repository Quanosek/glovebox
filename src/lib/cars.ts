/**
 * Car catalogue types shared by the server (database reader, importer) and
 * client components. Client-safe: no Node APIs.
 */

/** Car whose sections are tagged with the Opel Cascada MY16 feature rules. */
export const CASCADA_PROFILE = "opel-cascada-my16";
export const CASCADA_CAR_ID = "opel-cascada-2016";

export interface CarBook {
  /** Directory name inside the car folder; stored with highlights. */
  id: string;
  /** URL segment (`/auto/<car>/<route>`). */
  route: string;
  title: string;
  /** Short label for navigation. */
  short: string;
}

/** `database/<car>/car.json`. */
export interface CarFile {
  formatVersion: 1;
  id: string;
  brand: string;
  model: string;
  year: number;
  /** Optional free-text description (engine, version…). */
  variant?: string;
  /** Feature tagging profile; only `CASCADA_PROFILE` exists. */
  profile?: typeof CASCADA_PROFILE;
  /** Shipped with the repository; cannot be deleted from the UI. */
  builtIn?: boolean;
  createdAt: string;
  books: CarBook[];
}

/** Serialisable car description passed to client components. */
export interface CarSummary {
  id: string;
  brand: string;
  model: string;
  year: number;
  variant?: string;
  label: string;
  href: string;
  builtIn: boolean;
  hasProfile: boolean;
  books: Array<
    CarBook & {
      href: string;
      sections: number;
      pages: number | null;
      placeholder: boolean;
    }
  >;
}

export function carLabel(car: Pick<CarFile, "brand" | "model" | "year">) {
  return `${car.brand} ${car.model} ${car.year}`;
}

export function carHref(carId: string): string {
  return `/auto/${carId}`;
}

export function bookHref(carId: string, route: string): string {
  return `/auto/${carId}/${route}`;
}

/** Lookup helpers for client views that receive the catalogue as props. */
export function carName(cars: CarSummary[], id: string): string {
  return cars.find((c) => c.id === id)?.label ?? id;
}

export function bookName(cars: CarSummary[], carId: string, bookId: string) {
  return (
    cars.find((c) => c.id === carId)?.books.find((b) => b.id === bookId)
      ?.short ?? bookId
  );
}
