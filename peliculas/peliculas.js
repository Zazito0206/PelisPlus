async function initCatalogo() {
  const contenedor = document.getElementById("contenedor");
  const searchInput = document.querySelector(".search");
  const searchResults = document.querySelector(".search-results");
  const btnLogo = document.getElementById("btn-logo");
  const btnPeliculas = document.getElementById("btn-peliculas");

  let paginaActual = 1;
  let listaActual = [];
  const peliculasPorPagina = 24;

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

  function renderEstado(mensaje) {
    contenedor.innerHTML = `<div class="estado-vacio">${mensaje}</div>`;
  }

  function renderPagina(lista, pagina) {
    contenedor.innerHTML = "";

    if (!lista.length) {
      renderEstado("No encontramos peliculas para mostrar.");
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
    listaActual = data;

    searchInput.addEventListener("input", event => {
      const valor = event.target.value.trim();

      if (valor === "") {
        searchResults.style.display = "none";
        searchResults.innerHTML = "";
        paginaActual = 1;
        listaActual = data;
        renderPagina(listaActual, paginaActual);
        return;
      }

      const resultados = data.filter(p => similitud(p.titulo, valor));
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
      renderPagina(listaActual, paginaActual);
    });

    document.addEventListener("click", event => {
      if (!event.target.closest(".search-box")) {
        searchResults.style.display = "none";
      }
    });

    btnLogo.addEventListener("click", () => {
      window.location.reload();
    });

    btnPeliculas.addEventListener("click", event => {
      event.preventDefault();
      paginaActual = 1;
      listaActual = data;
      searchInput.value = "";
      searchResults.style.display = "none";
      searchResults.innerHTML = "";
      renderPagina(listaActual, paginaActual);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    renderPagina(listaActual, paginaActual);
  } catch (error) {
    renderEstado(error.message || "No se pudo cargar el catalogo.");
  }
}

initCatalogo();
