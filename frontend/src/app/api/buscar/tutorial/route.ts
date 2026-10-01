import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  return NextResponse.json({ tip: 'Recuerda usar equipo de seguridad adecuado para tus proyectos.' });
}
