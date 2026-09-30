import {
  Basket,
  Broom,
  Carrot,
  Cow,
  Egg,
  FirstAidKit,
  Grains,
  type Icon,
  OrangeSlice,
  PencilSimple,
  Tooth,
  Wine,
} from "@phosphor-icons/react";

// Un ícono por categoría: le da ritmo a la lista y se reconoce más rápido que el texto
const ICONOS: Record<string, Icon> = {
  "Tu canasta": Basket,
  Almacén: Grains,
  Bebidas: Wine,
  "Carnes y fiambres": Cow,
  "Farmacia y cuidado": FirstAidKit,
  Frutas: OrangeSlice,
  "Higiene personal": Tooth,
  "Lácteos y huevos": Egg,
  Limpieza: Broom,
  "Útiles escolares": PencilSimple,
  Verduras: Carrot,
};

export function IconoCategoria({ categoria, size = 18 }: { categoria: string; size?: number }) {
  const Componente = ICONOS[categoria] ?? Basket;
  return <Componente size={size} weight="duotone" aria-hidden />;
}
