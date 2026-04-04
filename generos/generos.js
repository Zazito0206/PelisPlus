async function initGeneros() {
  const contenedor = document.getElementById("contenedor");
  const searchInput = document.querySelector(".search");
  const searchResults = document.querySelector(".search-results");
  const btnLogo = document.getElementById("btn-logo");
  const btnGeneros = document.getElementById("btn-generos");
  const menuGeneros = document.getElementById("menu-generos");
  const tituloGenero = document.getElementById("titulo-genero");
  const descripcionGenero = document.getElementById("descripcion-genero");

  const params = new URLSearchParams(window.location.search);
  const generoActivo = params.get("categoria") || "";

  let paginaActual = 1;
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

  function renderEstadoVacio() {
    contenedor.innerHTML = `
      <div class="estado-vacio">
        No encontramos peliculas para esta categoria.
      </div>
    `;
  }

  function renderPagina(lista, pagina) {
    contenedor.innerHTML = "";

    if (!lista.length) {
      renderEstadoVacio();
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
    let listaActual = data.filter(p => (p.categoria || []).includes(generoActivo));

    tituloGenero.textContent = generoActivo || "Genero";
    descripcionGenero.textContent = generoActivo
      ? `Explora todas las peliculas de ${generoActivo}.`
      : "Selecciona una categoria desde el inicio para ver sus peliculas aqui.";
    btnGeneros.textContent = generoActivo ? `${generoActivo} ▾` : "Generos ▾";

    const generosUnicos = new Set();
    data.forEach(p => {
      (p.categoria || []).forEach(cat => generosUnicos.add(cat));
    });

    const listaGeneros = [...generosUnicos].sort((a, b) => a.localeCompare(b, "es"));

    listaGeneros.forEach(gen => {
      const item = document.createElement("span");
      item.textContent = gen;

      item.onclick = () => {
        window.location.href = `?categoria=${encodeURIComponent(gen)}`;
      };

      menuGeneros.appendChild(item);
    });

    searchInput.addEventListener("input", event => {
      const valor = event.target.value.trim();

      if (valor === "") {
        searchResults.style.display = "none";
        searchResults.innerHTML = "";
        paginaActual = 1;
        listaActual = data.filter(p => (p.categoria || []).includes(generoActivo));
        renderPagina(listaActual, paginaActual);
        return;
      }

      const resultados = data
        .filter(p => (p.categoria || []).includes(generoActivo))
        .filter(p => similitud(p.titulo, valor));

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
      if (!event.target.closest(".dropdown")) {
        menuGeneros.style.display = "none";
      }

      if (!event.target.closest(".search-box")) {
        searchResults.style.display = "none";
      }
    });

    btnLogo.addEventListener("click", () => {
      window.location.reload();
    });

    btnGeneros.addEventListener("click", event => {
      event.preventDefault();
      menuGeneros.style.display = menuGeneros.style.display === "grid" ? "none" : "grid";
    });

    renderPagina(listaActual, paginaActual);
  } catch (error) {
    contenedor.innerHTML = `<div class="estado-vacio">${error.message || "No se pudo cargar esta categoria."}</div>`;
  }
}

initGeneros();
