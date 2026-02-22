#!/bin/bash

# Deploy Cinematic UGC Proxy Server to Railway

echo "🎬 Deploying Cinematic UGC Proxy Server..."

# Check if railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "Installing Railway CLI..."
    npm install -g @railway/cli
fi

# Login with token
export RAILWAY_TOKEN="47b292e0-2ae6-41eb-a03b-2f9e2a6a3dd4"
railway login --token "$RAILWAY_TOKEN"

# Initialize project (if not already done)
if [ ! -f ".railway/config.json" ]; then
    echo "Initializing Railway project..."
    railway init --name "cinematic-ugc-proxy"
fi

# Set environment variables
echo "Setting environment variables..."
railway variables set GCP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDlV0cJGt8LmUuu
w4SHv/C7QF3ky4PEZGtp/g2kHh5CgvIRGhKhBWBUoNfxwZcIdtjdh6vn40XQX3Zf
3vCWlcP7olfJ3HO5CRj0/X9TzDfj+FMhpcNgZreSamyDKMKE2iY4cV/jYCGJs93Y
O0la8XTkFKKegBq6asHbpf23bd2v2fTc/KNVUG64KXARXZet6i+iIDvSjTzaydLH
ZhzeZCURziiBeUlSV+N4+NW11DI3/LxDI62vQ5aUIAo/YU9Gj7JU2tC/J57uzXbZ
jXFZgDs7ojOu1cT7UcRw7MUzAZvRHvinFjbouAgPtKv6iPTQ9SVwo738kLIGnIvw
NL8ttwZhAgMBAAECggEAL+uJaH3gopYMog7w64N/28Ryigq7NOdNqWc/9u2jIX8m
cMvbniEXNH+qN3XdptNcc4d0dD7BGO3FeHlHGJPhEDxm7wMc/AoKWLB6MSp/+Cas
SiDOft9flpydoVc8M9G4QD1yTXqJ73GxlkunA3Vl2P110DwQuahyasCXj8MJWgOB
ohdy1LUPc8Q1u1pL5cE/45Hqz72Aftg8BfHeAsx6RAFXuxY6FAj6Q8/6vDtWq+7W
Zh6mPOoPwT4wpG2IdhG5ImKjCPBujiVhcrGmMkf0x/6rQMuUq3ctj+fATX/bU+o/
qyKyFa0VpgVih23YuA0JgqWKbk0ilJG/oQSEpgu2FQKBgQD9YY+RFApKiyjA8jcD
pPPopCuVBWnM1ZYb0l12pg7T+WT+VtuqhD5D1V4h2fbdV24OVneraqreysrhX08u
8WHFvbJmWBoJOpjW9cD6MltPYFBT6SddyIkbiIHnIeICtZLNo8XkNF0Ff2neR5yG
XpF6i/kirCMfKk1KkNIuwz4tnQKBgQDnthto6UHDhxM/dkRsncmW92qJonxBlLsL
Cafyg7g+N/+B5t322h6ll7NZwFXW0ZUvAKkHm9f2pW9thRXVp64edz2zdIciBRk6
/39oeWcNcU2nYWM0WksMw4u0lVtsmZJMXcs1UtYZU7wiYAw7ovxpP4fnPaXjjWEX
TfykdJRClQKBgBphGNhK1NNz73c/AFlByB71UJBAMwafSfR1j0N2AF8zPL95/X6g
K/dV9Gnjzl625n9ZozXWchml1T9nc8/4U2yJ1lPvYi6JyjW++itSKM13woUp5e5O
nW+fY57TmTsc+j6siUK77N9Qp437uKEIoW63ueVRNIrfFZLoxukVbJjFAoGBAN2B
9qQNUQQVje3+Jp1bHgsHDT70KSscfs6ndXleOHSqXcUWKh1BGUkeQ6NKPgU1qBMd
43jVn9g3ANXHAz+To92WClMS09hO3XbMJ0V9wWlVZnHbpNW4d8SE73o7ygGAsh31
ED0yql/d751BCpC8V+ZZiJckFQD699UqhZnFpLIdAoGAcGWjiwnZHuSjw0mZaLCM
tqgSj4Y9XSgMNh1elThodtbG03wQmiNRxtIA+ZQR0N9MPm1aiUXL2TxGtey/wmgm
5exs2pAgzZ8bldKtdpjYg1I0wN7sqZxJsZ7dO4bowikm19E8LVgajSi3jqin3xA/
BG6c2KSHXjEJ18rcRxPV0sM=
-----END PRIVATE KEY-----"

# Deploy
echo "Deploying to Railway..."
railway up

echo "✅ Deployment complete!"
echo ""
echo "Your proxy server is now running at:"
railway domain
echo ""
echo "Test it with:"
echo "curl https://YOUR_DOMAIN/health"
