import { NextResponse } from 'next/server';

const INTERNAL_BASE = process.env.TV_INTERNAL || 'http://192.168.191.168:6789';

async function proxy(req: Request, params: { path?: string[] }) {
    try {
        const path = (params.path || []).join('/') || '';
        const url = new URL(INTERNAL_BASE.replace(/\/+$/, '') + '/' + path);
        const incomingUrl = new URL(req.url);
        incomingUrl.searchParams.forEach((v, k) => url.searchParams.append(k, v));

        const headers: Record<string, string> = {};
        req.headers.forEach((v, k) => {
            if (k.toLowerCase() === 'host') return;
            headers[k] = v as string;
        });

        const init: RequestInit = {
            method: req.method,
            headers,
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
            redirect: 'manual',
        };

        const upstream = await fetch(url.toString(), init);

        const resHeaders = new Headers();
        upstream.headers.forEach((v, k) => {
            if (['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-authenticate', 'proxy-authorization'].includes(k.toLowerCase())) return;
            resHeaders.set(k, v);
        });

        return new NextResponse(upstream.body, { status: upstream.status, headers: resHeaders });
    } catch (err) {
        return new NextResponse(String(err), { status: 500 });
    }
}

export async function GET(req: Request, { params }: { params?: { path?: string[] } } = {}) {
    return proxy(req, params || {});
}
export async function POST(req: Request, { params }: { params?: { path?: string[] } } = {}) {
    return proxy(req, params || {});
}
export async function PUT(req: Request, { params }: { params?: { path?: string[] } } = {}) {
    return proxy(req, params || {});
}
export async function DELETE(req: Request, { params }: { params?: { path?: string[] } } = {}) {
    return proxy(req, params || {});
}
export async function PATCH(req: Request, { params }: { params?: { path?: string[] } } = {}) {
    return proxy(req, params || {});
}
export async function OPTIONS(req: Request, { params }: { params?: { path?: string[] } } = {}) {
    return proxy(req, params || {});
}
