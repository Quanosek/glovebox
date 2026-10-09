import type { CarSpec } from "@/lib/catalog";

/**
 * Car types shared by the server (database reader, importer) and client
 * components. Client-safe: no Node APIs.
 */

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
  /** Catalogue ids when the car was chosen from the official list. */
  catalog?: { brand: string; model: string };
  /** Engine chosen from the official catalogue. */
  spec?: CarSpec;
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
  spec?: CarSpec;
  books: Array<
    CarBook & {
      href: string;
      sections: number;
      pages: number | null;
      placeholder: boolean;
    }
  >;
}

export function hasReadableManual(cars: CarSummary[]): boolean {
  return cars.some((car) => car.books.some((book) => !book.placeholder));
}

/** Section of a manual that describes an optional feature. */
export interface FeatureSectionLink {
  book: string;
  /** Short book name. */
  bookShort: string;
  title: string;
  href: string;
}

/** Equipment data of one car: feature id → sections describing it. */
export type CarFeatureSections = Record<string, FeatureSectionLink[]>;

export function carLabel(car: Pick<CarFile, "brand" | "model" | "year">) {
  return `${car.brand} ${car.model} ${car.year}`;
}

export function carHref(carId: string): string {
  return `/auto/${carId}`;
}

/** Equipment page of a car (`/auto/<car>/wyposazenie`). */
export function equipmentHref(carId: string): string {
  return `/auto/${carId}/wyposazenie`;
}

/** "Lampki kontrolne" glossary of a car. */
export function glossaryHref(carId: string): string {
  return `/auto/${carId}/lampki-kontrolne`;
}

/** "Dane techniczne" cards of a car. */
export function techDataHref(carId: string): string {
  return `/auto/${carId}/dane-techniczne`;
}

/** Official brand logo of the car's model year (served by `app/logo/[car]`). */
export function logoHref(carId: string): string {
  return `/logo/${carId}`;
}

/** Book routes that would clash with fixed pages under `/auto/<car>/`. */
export const RESERVED_BOOK_ROUTES = [
  "wyposazenie",
  "lampki-kontrolne",
  "dane-techniczne",
];

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
