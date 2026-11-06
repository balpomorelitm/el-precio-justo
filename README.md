# El Precio Justo · Edición aula

Una página para dirigir en clase una partida por equipos, inspirada en el concurso clásico.

## Jugar

1. Escribe los nombres de los equipos. Antes de empezar puedes revisar y editar los precios y el cambio EUR/HKD en «Productos y precios».
2. Introduce las propuestas en euros. Pulsa «Revelar el precio» para ver el resultado y la clasificación. Un campo vacío significa que el equipo no participa en esa ronda.
3. Al resolver la quinta ronda puedes terminar la partida o añadir preguntas extra. Los extras se colocan después de los seis productos iniciales.
4. En cualquier ronda revelada puedes corregir una propuesta: el marcador se recalcula automáticamente. Al terminar, descarga el resumen en CSV.

La partida y los precios personalizados se guardan en el almacenamiento local de ese navegador y dispositivo. El botón «Nueva partida» permite descargar primero el resultado anterior.

## Desarrollo

No se necesitan dependencias para la aplicación. Para abrir una vista previa local:

```sh
npm run dev
```

Las comprobaciones de puntuación se ejecutan con `npm test` y la versión publicable se prepara con `npm run build`. Netlify utiliza `netlify.toml` para construir el directorio `dist/` automáticamente desde GitHub.

Los precios son referencias consultadas el 6 de noviembre de 2026 y pueden modificarse en la pantalla inicial. El tipo de cambio inicial EUR/HKD procede del BCE, con fecha 5 de noviembre de 2026.
