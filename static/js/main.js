document.addEventListener('DOMContentLoaded', () => {
    // Inicializar Mapa
    const map = L.map('map').setView([-23.4425, -58.4438], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    let selectedLatLng = null;
    let tempMarker = null;

    // Icono personalizado para el marcador temporal
    const redIcon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    // Estaciones predefinidas (ejemplos)
    const estacionesDefault = [
        { nombre: 'Mcal. Estigarribia', lat: -22.0167, lng: -60.6167, depto: 'Boquerón' },
        { nombre: 'Paraguari', lat: -25.6167, lng: -57.15, depto: 'Paraguarí' },
        { nombre: 'Asunción', lat: -25.2637, lng: -57.5759, depto: 'Capital' }
    ];

    const markers = [];

    let stationToLink = null;
    let allEstaciones = [];
    const modalEstacion = document.getElementById('modal-estacion');

    function renderEstaciones(estacionesToRender) {
        const listContainer = document.getElementById('estaciones-list');

        // Limpiar markers previos
        markers.forEach(m => map.removeLayer(m));
        markers.length = 0;

        listContainer.innerHTML = '';

        estacionesToRender.forEach(est => {
            const lat = est.latitud || est.lat;
            const lng = est.longitud || est.lng;
            const nombre = est.nombre;
            const depto = est.departamento || est.depto;
            const hasCoords = lat !== null && lng !== null;

            if (hasCoords) {
                // Agregar al mapa
                const marker = L.marker([lat, lng])
                    .addTo(map)
                    .bindPopup(`<b>${nombre}</b><br>${depto}<br><small>${lat.toFixed(4)}, ${lng.toFixed(4)}</small>`)
                    .on('click', () => {
                        document.getElementById('ubicacion-input').value = nombre;
                    });
                markers.push(marker);
            }

            // Agregar a la tabla
            const tr = document.createElement('tr');
            if (!hasCoords) {
                tr.classList.add('has-text-danger', 'has-background-danger-light');
            }

            tr.innerHTML = `
                <td>${nombre}</td>
                <td>${depto}</td>
                <td class="has-text-right">
                    <div class="buttons are-small is-right" style="flex-wrap: nowrap;">
                        ${hasCoords ? `
                        <button class="button is-info is-light btn-view" data-lat="${lat}" data-lng="${lng}" title="Ver en mapa">
                            <span class="icon is-small"><i class="fas fa-eye"></i></span>
                        </button>
                        ` : `
                        <button class="button is-warning is-light btn-link" data-id="${est.id}" data-nombre="${nombre}" title="Asociar ubicación en mapa">
                            <span class="icon is-small"><i class="fas fa-link"></i></span>
                        </button>
                        `}
                        <button class="button is-link is-light btn-edit" data-id="${est.id}" title="Editar estación">
                            <span class="icon is-small"><i class="fas fa-pencil-alt"></i></span>
                        </button>
                        <button class="button is-danger is-light btn-delete" data-id="${est.id}" title="Eliminar estación">
                            <span class="icon is-small"><i class="fas fa-trash"></i></span>
                        </button>
                    </div>
                </td>
            `;
            listContainer.appendChild(tr);
        });

        // Eventos para botones "Ver"
        document.querySelectorAll('.btn-view').forEach(btn => {
            btn.onclick = () => {
                const lat = parseFloat(btn.dataset.lat);
                const lng = parseFloat(btn.dataset.lng);
                map.setView([lat, lng], 10);
                showNotification('Centrando mapa en la estación...', 'is-info');
            };
        });

        // Eventos para botones "Asociar"
        document.querySelectorAll('.btn-link').forEach(btn => {
            btn.onclick = () => {
                stationToLink = { id: btn.dataset.id, nombre: btn.dataset.nombre };
                showNotification(`Seleccione la ubicación para <b>${stationToLink.nombre}</b> haciendo clic derecho en el mapa.`, 'is-warning');
            };
        });

        // Eventos para botones "Editar"
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.onclick = () => {
                const id = btn.dataset.id;
                if (!id) {
                    showNotification('No se puede editar una estación predefinida.', 'is-warning');
                    return;
                }
                const est = allEstaciones.find(e => e.id == id);
                abrirModalEstacion(est);
            };
        });

        // Eventos para botones "Eliminar"
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.onclick = () => {
                const id = btn.dataset.id;
                if (!id) {
                    showNotification('No se puede eliminar una estación predefinida.', 'is-warning');
                    return;
                }

                if (confirm('¿Estás seguro de eliminar esta estación?')) {
                    fetch(`/api/estaciones/${id}`, { method: 'DELETE' })
                        .then(res => res.json())
                        .then(() => {
                            loadEstaciones();
                            showNotification('Estación eliminada.', 'is-success');
                        });
                }
            };
        });
    }

    function loadEstaciones() {
        fetch('/api/estaciones')
            .then(res => res.json())
            .then(data => {
                // Combinar con defaults si está vacío
                allEstaciones = data.length > 0 ? data : estacionesDefault;
                renderEstaciones(allEstaciones);
            });
    }
    function abrirModalEstacion(estacion = null) {
        const titulo = document.getElementById('modal-estacion-titulo');
        const inputId = document.getElementById('est-id');
        const inputNombre = document.getElementById('est-nombre');
        const inputDepto = document.getElementById('est-depto');
        const inputCoords = document.getElementById('est-coords');

        if (estacion) {
            titulo.innerText = 'Editar Estación';
            inputId.value = estacion.id;
            inputNombre.value = estacion.nombre;
            inputNombre.disabled = true;
            inputDepto.value = estacion.departamento || '';
            const lat = estacion.latitud || estacion.lat;
            const lng = estacion.longitud || estacion.lng;
            inputCoords.value = lat && lng ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : '';
            selectedLatLng = lat && lng ? { lat, lng } : null;
        } else {
            titulo.innerText = 'Agregar Nueva Estación';
            inputId.value = '';
            inputNombre.value = '';
            inputNombre.disabled = false;
            inputDepto.value = '';
            //inputCoords.value = '';
            selectedLatLng = null;
        }

        modalEstacion.classList.add('is-active');
    }

    const btnAbrirModalAdd = document.getElementById('btn-abrir-modal-add');
    if (btnAbrirModalAdd) btnAbrirModalAdd.onclick = () => abrirModalEstacion();
    const btnCloseModalEstacion = document.getElementById('btn-close-modal-estacion');
    if (btnCloseModalEstacion) btnCloseModalEstacion.onclick = () => modalEstacion.classList.remove('is-active');
    document.querySelectorAll('.btn-cancelar-estacion').forEach(btn => {
        btn.onclick = () => modalEstacion.classList.remove('is-active');
    });

    const btnGuardarEstacion = document.getElementById('btn-guardar-estacion');
    if (btnGuardarEstacion) btnGuardarEstacion.onclick = () => {
        const id = document.getElementById('est-id').value;
        const nombre = document.getElementById('est-nombre').value;
        const depto = document.getElementById('est-depto').value;

        if (!nombre || !depto || !selectedLatLng) {
            showNotification('Complete todos los campos y seleccione la ubicación en el mapa.', 'is-warning');
            return;
        }

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/estaciones/${id}` : '/api/estaciones';

        fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre,
                departamento: depto,
                latitud: selectedLatLng.lat,
                longitud: selectedLatLng.lng
            })
        })
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    showNotification(data.error, 'is-danger');
                    return;
                }
                showNotification(id ? 'Estación actualizada.' : 'Estación guardada.', 'is-success');
                modalEstacion.classList.remove('is-active');
                loadEstaciones();
            });
    };

    // Filtro de estaciones
    const filterEstEl = document.getElementById('filter-estaciones');
    if (filterEstEl) {
        filterEstEl.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = allEstaciones.filter(est => {
                const nombre = (est.nombre || '').toLowerCase();
                const depto = (est.departamento || est.depto || '').toLowerCase();
                return nombre.includes(term) || depto.includes(term);
            });
            renderEstaciones(filtered);
        });
    }

    loadEstaciones();

    function showNotification(message, type = 'is-info') {
        const container = document.getElementById('notification-container');
        const notification = document.createElement('div');
        notification.className = `notification ${type} is-light animate__animated animate__fadeInRight`;
        notification.innerHTML = `
            <button class="delete"></button>
            ${message}
        `;

        container.appendChild(notification);

        notification.querySelector('.delete').onclick = () => {
            notification.remove();
        };

        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.replace('animate__fadeInRight', 'animate__fadeOutRight');
                setTimeout(() => notification.remove(), 500);
            }
        }, 4000);
    }

    // Manejo de clic derecho para coordenadas de nueva estación
    map.on('contextmenu', (e) => {
        selectedLatLng = e.latlng;

        if (stationToLink) {
            // Asociar ubicación a estación existente (Legacy support for quick link)
            if (confirm(`¿Asociar esta ubicación a la estación ${stationToLink.nombre}?`)) {
                fetch(`/api/estaciones/${stationToLink.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        latitud: e.latlng.lat,
                        longitud: e.latlng.lng
                    })
                })
                    .then(res => res.json())
                    .then(() => {
                        showNotification(`Ubicación asociada a ${stationToLink.nombre}`, 'is-success');
                        stationToLink = null;
                        loadEstaciones();
                    });
            }
            return;
        }

        // Eliminar marcador temporal previo si existe
        if (tempMarker) {
            map.removeLayer(tempMarker);
        }

        // Crear nuevo marcador temporal rojo
        tempMarker = L.marker(e.latlng, { icon: redIcon }).addTo(map);
        tempMarker.bindPopup("Ubicación Seleccionada").openPopup();

        // Actualizar campo en el modal si existe
        const inputCoords = document.getElementById('est-coords');
        if (inputCoords) {
            inputCoords.value = `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`;
        }

        showNotification(`Coordenadas capturadas: ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`, 'is-success');
    });

    // Botón Predecir
    const btnPredecir = document.getElementById('btn-predecir');
    if (btnPredecir) {
        btnPredecir.addEventListener('click', () => {
            const ubicacionEl = document.getElementById('ubicacion-input');
            const mesEl = document.getElementById('mes-select');
            const anhoEl = document.getElementById('anho-input');
            const ubicacion = ubicacionEl ? ubicacionEl.value : '';
            const mes = mesEl ? mesEl.value : '';
            const anho = anhoEl ? anhoEl.value : '';

        if (!ubicacion) {
            showNotification('Por favor seleccione una ubicación en el mapa.', 'is-warning');
            return;
        }

        const resDiv = document.getElementById('resultado');
        const resSkeleton = document.getElementById('resultado-skeleton');

        resDiv.classList.add('is-hidden');
        resSkeleton.classList.remove('is-hidden');

        fetch('/api/predecir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mes, anho, ubicacion })
        })
            .then(res => res.json())
            .then(data => {
                resSkeleton.classList.add('is-hidden');

                if (typeof data.error === 'string') {
                    showNotification(data.error, 'is-danger');
                    return;
                }

                resDiv.classList.remove('is-hidden');
                document.getElementById('res-estimacion').innerText = data.estimacion;
                document.getElementById('res-probabilidad').innerText = data.probabilidad;
                document.getElementById('res-intensidad').innerText = data.intensidad;
                document.getElementById('res-emoji').innerText = data.emoji;

                const contrasteDiv = document.getElementById('res-contraste');
                if (data.real !== null) {
                    contrasteDiv.classList.remove('is-hidden');
                    document.getElementById('res-real').innerText = data.real;
                    document.getElementById('res-error').innerText = data.error;
                } else {
                    contrasteDiv.classList.add('is-hidden');
                }
                showNotification('Predicción calculada con éxito.', 'is-success');
            });
        });
    }

    // Gráfico Histórico
    let historicoChart = null;
    const modal = document.getElementById('modal-historico');

    // Diagrama de Dispersión (Validación)
    let validacionChart = null;
    const modalVal = document.getElementById('modal-validacion');

    document.getElementById('btn-ver-validacion').onclick = () => {
        const ubicacion = document.getElementById('ubicacion-input').value;
        if (!ubicacion) {
            showNotification('Por favor seleccione una ubicación en el mapa.', 'is-warning');
            return;
        }

        document.getElementById('val-titulo').innerText = ubicacion;
        modalVal.classList.add('is-active');

        // Mostrar loader y ocultar canvas/metrics
        document.getElementById('val-loader').classList.remove('is-hidden');
        document.getElementById('chart-validacion').classList.add('is-hidden');
        document.getElementById('val-metrics').classList.add('is-hidden');

        const mes = document.getElementById('mes-select').value;
        const anho = parseInt(document.getElementById('anho-input').value, 10) || new Date().getFullYear();

        fetch('/api/validacion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ubicacion, mes, anho })
        })
            .then(res => res.json())
            .then(data => {
                document.getElementById('val-loader').classList.add('is-hidden');

                const pairs = data.pairs || [];
                if (!pairs.length) {
                    showNotification('No hay pares reales/predichos disponibles para esta ubicación.', 'is-warning');
                    return;
                }

                document.getElementById('chart-validacion').classList.remove('is-hidden');
                document.getElementById('val-metrics').classList.remove('is-hidden');

                // Mostrar métricas
                const rmse = (typeof data.rmse === 'number') ? data.rmse.toFixed(2) : '-';
                const r2 = (typeof data.r2 === 'number') ? data.r2.toFixed(3) : '-';
                document.getElementById('val-rmse').innerText = rmse;
                document.getElementById('val-r2').innerText = r2;

                // Mostrar rango de años usado
                const years = pairs.map(p => p.anho);
                const minYear = Math.min(...years);
                const maxYear = Math.max(...years);
                document.getElementById('val-range').innerText = `${minYear} — ${maxYear}`;

                // Preparar datos para Chart.js (scatter) y agrupar por año
                const reals = pairs.map(p => p.real);
                const preds = pairs.map(p => p.predicho);
                const minVal = Math.min(...reals.concat(preds));
                const maxVal = Math.max(...reals.concat(preds));

                // Determinar años presentes y asignar colores HSL
                const uniqueYears = Array.from(new Set(pairs.map(p => p.anho))).sort((a,b)=>a-b);
                const yearColors = {};
                uniqueYears.forEach((y, i) => {
                    const hue = Math.floor((i * 360) / Math.max(1, uniqueYears.length));
                    yearColors[y] = `hsla(${hue}, 75%, 45%, 0.85)`;
                });

                // Crear un dataset por año para que cada año tenga color y leyenda
                const perYearDatasets = uniqueYears.map(y => ({
                    label: String(y),
                    data: pairs.filter(p => p.anho === y).map(p => ({ x: p.real, y: p.predicho, label: `${p.mes} ${p.anho}` })),
                    backgroundColor: yearColors[y],
                    pointRadius: 6,
                    showLine: false
                }));

                const ctx = document.getElementById('chart-validacion').getContext('2d');
                if (validacionChart) {
                    validacionChart.destroy();
                }

                validacionChart = new Chart(ctx, {
                    type: 'scatter',
                    data: {
                        datasets: [
                            ...perYearDatasets,
                            {
                                label: 'Diagonal 1:1',
                                data: [{ x: minVal, y: minVal }, { x: maxVal, y: maxVal }],
                                type: 'line',
                                borderColor: 'rgba(200,0,0,0.8)',
                                borderWidth: 1,
                                fill: false,
                                pointRadius: 0,
                                tension: 0
                            }
                        ]
                    },
                    options: {
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const d = context.raw || {};
                                        if (d && typeof d.x !== 'undefined' && typeof d.y !== 'undefined') {
                                            return `${d.label || ''}: Real=${d.x}, Pred=${d.y}`;
                                        }
                                        return '';
                                    }
                                }
                            },
                            legend: { position: 'top' }
                        },
                        scales: {
                            x: {
                                title: { display: true, text: 'Real (mm)' }
                            },
                            y: {
                                title: { display: true, text: 'Predicho (mm)' }
                            }
                        }
                    }
                });
            })
            .catch(() => {
                document.getElementById('val-loader').classList.add('is-hidden');
                showNotification('Error al generar el diagrama de dispersión.', 'is-danger');
            });
    };

    document.getElementById('btn-close-modal-val').onclick = () => modalVal.classList.remove('is-active');

    document.getElementById('btn-ver-historico').onclick = () => {
        const ubicacion = document.getElementById('ubicacion-input').value;
        const mes = document.getElementById('mes-select').value;
        const anho = document.getElementById('anho-input').value;

        document.getElementById('hist-titulo').innerText = `${ubicacion} (${mes})`;
        modal.classList.add('is-active');

        // Mostrar loader y ocultar canvas
        document.getElementById('hist-loader').classList.remove('is-hidden');
        document.getElementById('chart-historico').classList.add('is-hidden');

        fetch('/api/historico', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mes, ubicacion, anho })
        })
            .then(res => res.json())
            .then(data => {
                // Ocultar loader y mostrar canvas
                document.getElementById('hist-loader').classList.add('is-hidden');
                document.getElementById('chart-historico').classList.remove('is-hidden');

                const ctx = document.getElementById('chart-historico').getContext('2d');

                if (historicoChart) {
                    historicoChart.destroy();
                }

                const labels = data.map(d => d.label);
                const values = data.map(d => d.valor);
                const normalizedValues = data.map(d => d.valor_normalizado);

                // Función para calcular regresión lineal
                const calculateRegression = (yValues) => {
                    const n = yValues.length;
                    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
                    for (let i = 0; i < n; i++) {
                        sumX += i;
                        sumY += yValues[i];
                        sumXY += i * yValues[i];
                        sumXX += i * i;
                    }
                    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
                    const intercept = (sumY - slope * sumX) / n;
                    return yValues.map((_, i) => slope * i + intercept);
                };

                const regressionValues = calculateRegression(values);

                // Estilos condicionales para datos reales vs proyectados
                const pointBackgroundColors = data.map(d =>
                    d.es_prediccion ? 'rgba(150, 150, 150, 0.5)' : (d.mes === mes ? 'rgba(255, 99, 132, 1)' : 'rgba(54, 162, 235, 1)')
                );
                const pointRadius = data.map(d =>
                    d.es_prediccion ? 2 : (d.mes === mes ? 6 : 3)
                );
                const pointStyle = data.map(d => d.es_prediccion ? 'rectRot' : 'circle');

                historicoChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: 'Precipitación (mm)',
                                data: values,
                                borderColor: 'rgba(54, 162, 235, 0.5)',
                                backgroundColor: 'rgba(54, 162, 235, 0.05)',
                                borderWidth: 1,
                                fill: true,
                                tension: 0.3,
                                pointBackgroundColor: pointBackgroundColors,
                                pointRadius: pointRadius,
                                pointStyle: pointStyle,
                                pointHoverRadius: 8,
                                segment: {
                                    borderDash: ctx => {
                                        const p0 = data[ctx.p0DataIndex];
                                        const p1 = data[ctx.p1DataIndex];
                                        return (p0.es_prediccion || p1.es_prediccion) ? [5, 5] : undefined;
                                    },
                                    borderColor: ctx => {
                                        const p0 = data[ctx.p0DataIndex];
                                        const p1 = data[ctx.p1DataIndex];
                                        return (p0.es_prediccion || p1.es_prediccion) ? 'rgba(150, 150, 150, 0.8)' : undefined;
                                    }
                                }
                            },
                            {
                                label: 'Tendencia Normalizada',
                                data: normalizedValues,
                                borderColor: 'rgba(75, 192, 192, 1)',
                                backgroundColor: 'transparent',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                fill: false,
                                tension: 0.4,
                                pointRadius: 0
                            },
                            {
                                label: 'Tendencia Matemática (Regresión)',
                                data: regressionValues,
                                borderColor: 'rgba(255, 159, 64, 1)',
                                backgroundColor: 'transparent',
                                borderWidth: 2,
                                fill: false,
                                pointRadius: 0,
                                borderDash: [2, 2]
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            y: {
                                beginAtZero: true,
                                title: { display: true, text: 'mm' }
                            },
                            x: {
                                ticks: {
                                    maxRotation: 45,
                                    minRotation: 45,
                                    autoSkip: true,
                                    maxTicksLimit: 20
                                }
                            }
                        },
                        plugins: {
                            legend: {
                                display: true,
                                position: 'top',
                                labels: { boxWidth: 12 }
                            },
                            tooltip: {
                                callbacks: {
                                    label: (context) => {
                                        const val = context.parsed.y;
                                        const label = context.dataset.label;
                                        const isPred = data[context.dataIndex].es_prediccion;
                                        return ` ${label}: ${val.toFixed(1)} mm ${isPred ? '(Proyectado)' : ''}`;
                                    }
                                }
                            }
                        }
                    }
                });
            });
    };

    document.getElementById('btn-close-modal').onclick = () => modal.classList.remove('is-active');
    modal.querySelector('.modal-background').onclick = () => modal.classList.remove('is-active');

    // Gráfico de Estacionalidad
    let estacionalidadChart = null;
    const modalEst = document.getElementById('modal-estacionalidad');

    document.getElementById('btn-ver-estacionalidad').onclick = () => {
        const ubicacion = document.getElementById('ubicacion-input').value;
        if (!ubicacion) {
            showNotification('Seleccione una ubicación en el mapa primero.', 'is-warning');
            return;
        }

        document.getElementById('est-titulo').innerText = ubicacion;
        modalEst.classList.add('is-active');

        // Mostrar loader y ocultar canvas
        document.getElementById('est-loader').classList.remove('is-hidden');
        document.getElementById('chart-estacionalidad').classList.add('is-hidden');

        fetch('/api/estacionalidad', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ubicacion })
        })
            .then(res => res.json())
            .then(data => {
                // Ocultar loader y mostrar canvas
                document.getElementById('est-loader').classList.add('is-hidden');
                document.getElementById('chart-estacionalidad').classList.remove('is-hidden');

                const ctx = document.getElementById('chart-estacionalidad').getContext('2d');
                if (estacionalidadChart) {
                    estacionalidadChart.destroy();
                }

                const labels = data.map(d => d.mes);
                const values = data.map(d => d.promedio);

                // Calcular media móvil para la curva de tendencia
                const movingAverage = (arr, size) => {
                    return arr.map((_, i, a) => {
                        const start = Math.max(0, i - Math.floor(size / 2));
                        const end = Math.min(a.length, i + Math.ceil(size / 2));
                        const subset = a.slice(start, end);
                        const sum = subset.reduce((acc, val) => acc + val, 0);
                        return sum / subset.length;
                    });
                };
                const trendValues = movingAverage(values, 3);

                estacionalidadChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: 'Promedio Mensual (mm)',
                                data: values,
                                borderColor: 'rgba(54, 162, 235, 1)',
                                backgroundColor: 'rgba(54, 162, 235, 0.1)',
                                borderWidth: 2,
                                fill: true,
                                tension: 0.4,
                                pointRadius: 4,
                                pointBackgroundColor: 'rgba(54, 162, 235, 1)'
                            },
                            {
                                label: 'Curva de Tendencia (Suavizada)',
                                data: trendValues,
                                borderColor: 'rgba(255, 99, 132, 0.8)',
                                backgroundColor: 'transparent',
                                borderWidth: 3,
                                borderDash: [5, 5],
                                fill: false,
                                tension: 0.5,
                                pointRadius: 0
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            y: {
                                beginAtZero: true,
                                title: { display: true, text: 'mm' }
                            }
                        },
                        plugins: {
                            legend: {
                                display: true,
                                position: 'top'
                            },
                            tooltip: {
                                callbacks: {
                                    label: (context) => ` ${context.dataset.label}: ${context.parsed.y.toFixed(1)} mm`
                                }
                            }
                        }
                    }
                });
            });
    };

    document.getElementById('btn-close-modal-est').onclick = () => modalEst.classList.remove('is-active');
    modalEst.querySelector('.modal-background').onclick = () => modalEst.classList.remove('is-active');

    // Gráfico de Estacionariedad
    let estacionariedadChart = null;
    const modalEsta = document.getElementById('modal-estacionariedad');

    document.getElementById('btn-ver-estacionariedad').onclick = () => {
        const ubicacion = document.getElementById('ubicacion-input').value;
        if (!ubicacion) {
            showNotification('Seleccione una ubicación en el mapa primero.', 'is-warning');
            return;
        }

        document.getElementById('esta-titulo').innerText = ubicacion;
        modalEsta.classList.add('is-active');

        // Mostrar loader y ocultar canvas
        document.getElementById('esta-loader').classList.remove('is-hidden');
        document.getElementById('chart-estacionariedad').classList.add('is-hidden');

        fetch('/api/estacionariedad', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ubicacion })
        })
            .then(res => res.json())
            .then(data => {
                // Ocultar loader y mostrar canvas
                document.getElementById('esta-loader').classList.add('is-hidden');
                document.getElementById('chart-estacionariedad').classList.remove('is-hidden');

                const ctx = document.getElementById('chart-estacionariedad').getContext('2d');
                if (estacionariedadChart) {
                    estacionariedadChart.destroy();
                }

                const labels = data.map(d => d.label);
                const original = data.map(d => d.original);
                const mean = data.map(d => d.mean);
                const std = data.map(d => d.std);

                estacionariedadChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: 'Datos Originales',
                                data: original,
                                borderColor: 'rgba(54, 162, 235, 0.7)',
                                backgroundColor: 'transparent',
                                borderWidth: 1,
                                pointRadius: 0,
                                fill: false
                            },
                            {
                                label: 'Media Móvil (12m)',
                                data: mean,
                                borderColor: 'rgba(255, 99, 132, 1)',
                                backgroundColor: 'transparent',
                                borderWidth: 2,
                                pointRadius: 0,
                                fill: false,
                                tension: 0.4
                            },
                            {
                                label: 'Desv. Estándar Móvil',
                                data: std,
                                borderColor: 'rgba(75, 192, 192, 1)',
                                backgroundColor: 'rgba(75, 192, 192, 0.1)',
                                borderWidth: 2,
                                pointRadius: 0,
                                fill: true,
                                tension: 0.4
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            y: {
                                beginAtZero: true,
                                title: { display: true, text: 'mm / Std' }
                            },
                            x: {
                                ticks: {
                                    autoSkip: true,
                                    maxTicksLimit: 15
                                }
                            }
                        },
                        plugins: {
                            legend: { position: 'top' },
                            tooltip: {
                                mode: 'index',
                                intersect: false,
                                callbacks: {
                                    label: (context) => ` ${context.dataset.label}: ${context.parsed.y.toFixed(1)}`
                                }
                            }
                        }
                    }
                });
            });
    };

    const btnCloseModalEsta = document.getElementById('btn-close-modal-esta');
    if (btnCloseModalEsta) btnCloseModalEsta.onclick = () => modalEsta.classList.remove('is-active');
    if (modalEsta) {
        const mbg2 = modalEsta.querySelector('.modal-background');
        if (mbg2) mbg2.onclick = () => modalEsta.classList.remove('is-active');
    }

    // Botón Añadir Estación
    const btnAddEstacion = document.getElementById('btn-add-estacion');
    if (btnAddEstacion) {
        btnAddEstacion.addEventListener('click', () => {
            const nombreEl = document.getElementById('est-nombre');
            const deptoEl = document.getElementById('est-depto');
            const nombre = nombreEl ? nombreEl.value : '';
            const depto = deptoEl ? deptoEl.value : '';

        if (!nombre || !depto || !selectedLatLng) {
            showNotification('Complete nombre, departamento y haga clic derecho en el mapa.', 'is-warning');
            return;
        }

        fetch('/api/estaciones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre,
                departamento: depto,
                latitud: selectedLatLng.lat,
                longitud: selectedLatLng.lng
            })
        })
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    showNotification(data.error, 'is-danger');
                    return;
                }
                loadEstaciones();
                showNotification('Estación añadida con éxito.', 'is-success');
                document.getElementById('est-nombre').value = '';
                document.getElementById('est-depto').value = '';
                document.getElementById('est-coords').value = '';
                if (tempMarker) {
                    map.removeLayer(tempMarker);
                    tempMarker = null;
                }
            });
        });
    }

    // Manejo de Archivo CSV
    const fileInput = document.getElementById('csv-file');
    if (fileInput) {
        fileInput.onchange = () => {
            if (fileInput.files.length > 0) {
                const fileNameEl = document.getElementById('file-name');
                if (fileNameEl) fileNameEl.innerText = fileInput.files[0].name;
            }
        };
    }

    const btnUpload = document.getElementById('btn-upload');
    if (btnUpload) {
        btnUpload.addEventListener('click', () => {
            if (!fileInput || fileInput.files.length === 0) {
                showNotification('Seleccione un archivo.', 'is-warning');
                return;
            }

        const formData = new FormData();
        formData.append('file', fileInput.files[0]);

        showNotification('Subiendo datos...', 'is-info');

        fetch('/api/upload', {
            method: 'POST',
            body: formData
        })
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    showNotification(data.error, 'is-danger');
                } else {
                    showNotification('Datos cargados correctamente.', 'is-success');
                    setTimeout(() => location.reload(), 1500);
                }
            })
            .catch(err => {
                showNotification('Error al subir el archivo.', 'is-danger');
            });
        });
    }
});
