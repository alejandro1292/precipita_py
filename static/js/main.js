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

    function loadEstaciones() {
        const listContainer = document.getElementById('estaciones-list');
        // No limpiar inmediatamente para mantener skeletons si es la primera carga
        // o mostrar skeletons si ya hay datos pero estamos refrescando

        fetch('/api/estaciones')
            .then(res => res.json())
            .then(data => {
                // Limpiar markers previos
                markers.forEach(m => map.removeLayer(m));
                markers.length = 0;

                listContainer.innerHTML = '';

                // Combinar con defaults si está vacío
                const allEstaciones = data.length > 0 ? data : estacionesDefault;

                allEstaciones.forEach(est => {
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
                            <div class="buttons are-small is-right">
                                ${hasCoords ? `
                                <button class="button is-info is-light btn-view" data-lat="${lat}" data-lng="${lng}" title="Ver en mapa">
                                    <span class="icon is-small"><i class="fas fa-eye"></i></span>
                                </button>
                                ` : `
                                <button class="button is-warning is-light btn-link" data-id="${est.id}" data-nombre="${nombre}" title="Asociar ubicación en mapa">
                                    <span class="icon is-small"><i class="fas fa-link"></i></span>
                                </button>
                                `}
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
            // Asociar ubicación a estación existente
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
        tempMarker.bindPopup("Nueva Estación Seleccionada").openPopup();

        document.getElementById('est-coords').value = `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`;
        showNotification(`Coordenadas seleccionadas: ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`, 'is-success');
    });

    // Botón Predecir
    document.getElementById('btn-predecir').addEventListener('click', () => {
        const ubicacion = document.getElementById('ubicacion-input').value;
        const mes = document.getElementById('mes-select').value;
        const anho = document.getElementById('anho-input').value;

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

    // Gráfico Histórico
    let historicoChart = null;
    const modal = document.getElementById('modal-historico');

    document.getElementById('btn-ver-historico').onclick = () => {
        const ubicacion = document.getElementById('ubicacion-input').value;
        const mes = document.getElementById('mes-select').value;

        document.getElementById('hist-titulo').innerText = `${ubicacion} (${mes})`;
        modal.classList.add('is-active');

        fetch('/api/historico', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mes, ubicacion })
        })
            .then(res => res.json())
            .then(data => {
                const ctx = document.getElementById('chart-historico').getContext('2d');

                if (historicoChart) {
                    historicoChart.destroy();
                }

                const labels = data.map(d => d.label);
                const values = data.map(d => d.valor);
                const normalizedValues = data.map(d => d.valor_normalizado);

                // Colores y tamaños para resaltar el mismo mes
                const pointBackgroundColors = data.map(d =>
                    d.mes === mes ? 'rgba(255, 99, 132, 1)' : 'rgba(54, 162, 235, 1)'
                );
                const pointRadius = data.map(d =>
                    d.mes === mes ? 6 : 3
                );

                historicoChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: 'Precipitación Real (mm)',
                                data: values,
                                borderColor: 'rgba(54, 162, 235, 0.5)',
                                backgroundColor: 'rgba(54, 162, 235, 0.05)',
                                borderWidth: 1,
                                fill: true,
                                tension: 0.3,
                                pointBackgroundColor: pointBackgroundColors,
                                pointRadius: pointRadius,
                                pointHoverRadius: 8
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
                                        return ` ${label}: ${val} mm`;
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

    // Botón Añadir Estación
    document.getElementById('btn-add-estacion').addEventListener('click', () => {
        const nombre = document.getElementById('est-nombre').value;
        const depto = document.getElementById('est-depto').value;

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

    // Manejo de Archivo CSV
    const fileInput = document.getElementById('csv-file');
    fileInput.onchange = () => {
        if (fileInput.files.length > 0) {
            document.getElementById('file-name').innerText = fileInput.files[0].name;
        }
    };

    document.getElementById('btn-upload').addEventListener('click', () => {
        if (fileInput.files.length === 0) {
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
});
