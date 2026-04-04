const LISTA_KEY = "pelisplus-mi-lista";

async function initMiLista() {
  const contenedor = document.getElementById("contenedor");
  const searchInput = document.querySelector(".search");
  const searchResults = document.querySelector(".search-results");
  const btnLogo = document.getElementById("btn-logo");
  const btnMiLista = document.getElementById("btn-mi-lista");

  let paginaActual = 1;
  const peliculasPorPagina = 24;

  function leerStorage() {
    try {
      const valor = JSON.parse(localStorage.getItem(LISTA_KEY));
      return Array.isArray(valor) ? valor : [];
    } catch {
      return [];
    }
  }

  function obtenerMiLista(catalogo) {
    const ids = leerStorage();
    return ids
      .map(id => catalogo.find(peli => peli.id === id))
      .filter(Boolean);
  }

  function crearCard(peli) {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <img src="${window.pelisData.resolveAssetUrl(peli.imagen, "../")}" alt="${peli.titulo}">
      <span>${peli.titulo}</span>
    `;

    card.onclick = () => {
      window.location.href = `../ver/pelicula.html?id=${peli.id}`;
    };

    return card;
  }

  function renderEstadoVacio(mensaje) {
    contenedor.innerHTML = `
      <div class="estado-vacio">${mensaje}</div>
    `;
  }

  function renderPagina(lista, pagina) {
    contenedor.innerHTML = "";

    if (!lista.length) {
      renderEstadoVacio("Todavia no has guardado peliculas. Entra a una ficha y usa el boton de mi lista para empezar.");
      return;
    }

    const inicio = (pagina - 1) * peliculasPorPagina;
    const fin = inicio + peliculasPorPagina;
    const peliculasPagina = lista.slice(inicio, fin);
    const totalPaginas = Math.max(1, Math.ceil(lista.length / peliculasPorPagina));

    const grid = document.createElement("div");
    grid.className = "grid-peliculas";

    peliculasPagina.forEach(peli => {
      grid.appendChild(crearCard(peli));
    });

    contenedor.appendChild(grid);

    const paginacion = document.createElement("div");
    paginacion.className = "paginacion";
    paginacion.innerHTML = `
      <button class="btn-prev">&#8592;</button>
      <div class="info-pagina">
        <span class="pagina-num">${pagina}</span>
        <span>de</span>
        <span>${totalPaginas}</span>
      </div>
      <button class="btn-next">&#8594;</button>
    `;

    const btnPrev = paginacion.querySelector(".btn-prev");
    const btnNext = paginacion.querySelector(".btn-next");

    btnPrev.disabled = pagina === 1;
    btnNext.disabled = pagina === totalPaginas;

    btnPrev.onclick = () => {
      if (paginaActual > 1) {
        paginaActual--;
        renderPagina(lista, paginaActual);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };

    btnNext.onclick = () => {
      if (paginaActual < totalPaginas) {
        paginaActual++;
        renderPagina(lista, paginaActual);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };

    contenedor.appendChild(paginacion);
  }

  function normalizar(texto) {
    return String(texto || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function similitud(a, b) {
    a = normalizar(a);
    b = normalizar(b);

    if (a.includes(b) || b.includes(a)) {
      return true;
    }

    let errores = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] !== b[i]) {
        errores++;
      }
    }

    return errores <= 2;
  }

  try {
    const data = await window.pelisData.fetchMoviesFromSupabase();
    let listaActual = obtenerMiLista(data);

    searchInput.addEventListener("input", event => {
      const valor = event.target.value.trim();
      const base = obtenerMiLista(data);

      if (valor === "") {
        searchResults.style.display = "none";
        searchResults.innerHTML = "";
        paginaActual = 1;
        listaActual = base;
        renderPagina(listaActual, paginaActual);
        return;
      }

      const resultados = base.filter(peli => similitud(peli.titulo, valor));
      listaActual = resultados;
      searchResults.innerHTML = "";

      resultados.slice(0, 6).forEach(peli => {
        const item = document.createElement("div");
        item.className = "search-item";

        item.innerHTML = `
          <img src="${window.pelisData.resolveAssetUrl(peli.imagen, "../")}" alt="${peli.titulo}">
          <span>${peli.titulo}</span>
        `;

        item.onclick = () => {
          window.location.href = `../ver/pelicula.html?id=${peli.id}`;
        };

        searchResults.appendChild(item);
      });

      searchResults.style.display = resultados.length ? "block" : "none";
      paginaActual = 1;

      if (!resultados.length) {
        renderEstadoVacio("No encontramos peliculas en tu lista con esa busqueda.");
        return;
      }

      renderPagina(listaActual, paginaActual);
    });

    document.addEventListener("click", event => {
      if (!event.target.closest(".search-box")) {
        searchResults.style.display = "none";
      }
    });

    btnLogo.addEventListener("click", () => {
      window.location.href = "../index.html";
    });

    btnMiLista.addEventListener("click", event => {
      event.preventDefault();
      paginaActual = 1;
      listaActual = obtenerMiLista(data);
      searchInput.value = "";
      searchResults.style.display = "none";
      searchResults.innerHTML = "";
      renderPagina(listaActual, paginaActual);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    renderPagina(listaActual, paginaActual);
  } catch (error) {
    renderEstadoVacio(error.message || "Ocurrio un problema al cargar tu lista.");
  }
}

initMiLista();
