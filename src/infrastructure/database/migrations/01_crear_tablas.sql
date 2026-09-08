-- Script de inicialización de Base de Datos para Supabase (PostgreSQL)
-- Ejecutar esto en el SQL Editor de Supabase

-- 1. Habilitar extensión para generar UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabla de Productos
CREATE TABLE productos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10, 2) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    marca VARCHAR(100),
    imagen_url TEXT,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Sustitutos (Relación muchos a muchos entre productos)
CREATE TABLE sustitutos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    producto_origen_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    producto_destino_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    nivel_similitud DECIMAL(3, 2) CHECK (nivel_similitud >= 0 AND nivel_similitud <= 1),
    razon TEXT,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(producto_origen_id, producto_destino_id)
);

-- 4. Índices para mejorar la velocidad de búsqueda
CREATE INDEX idx_productos_nombre ON productos(nombre);
CREATE INDEX idx_productos_sku ON productos(sku);
CREATE INDEX idx_sustitutos_origen ON sustitutos(producto_origen_id);

-- 5. Datos de prueba iniciales (Seeds)
INSERT INTO productos (id, sku, nombre, descripcion, precio, stock, marca) VALUES 
('11111111-1111-1111-1111-111111111111', 'TORN-MAD-2', 'Tornillo para madera 2 pulgadas', 'Tornillo autoperforante cabeza phillips', 15.50, 500, 'FerreMax'),
('22222222-2222-2222-2222-222222222222', 'TORN-MAD-2.5', 'Tornillo para madera 2.5 pulgadas', 'Tornillo autoperforante cabeza phillips largo', 18.00, 300, 'FerreMax'),
('33333333-3333-3333-3333-333333333333', 'CLAV-AC-2', 'Clavo de acero 2 pulgadas', 'Clavo de acero cabeza plana', 8.00, 1000, 'AceroFuerte');

INSERT INTO sustitutos (producto_origen_id, producto_destino_id, nivel_similitud, razon) VALUES 
('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 0.85, 'Mismo tipo de tornillo, medio milímetro más largo, útil si no hay stock del exacto');
