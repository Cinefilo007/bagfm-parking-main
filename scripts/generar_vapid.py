import base64
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

def generate_vapid_keys():
    # Generar llave privada EC P-256
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()

    # Formatear llave privada (32 bytes raw)
    private_num = private_key.private_numbers().private_value
    private_bytes = private_num.to_bytes(32, 'big')
    private_base64 = base64.urlsafe_b64encode(private_bytes).decode('utf-8').rstrip('=')

    # Formatear llave pública (65 bytes uncompressed: 0x04 + X + Y)
    public_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint
    )
    public_base64 = base64.urlsafe_b64encode(public_bytes).decode('utf-8').rstrip('=')

    return public_base64, private_base64

if __name__ == "__main__":
    pub, priv = generate_vapid_keys()
    print("\n--- COPIA ESTAS CLAVES EN TUS ARCHIVOS .env ---")
    print(f"VAPID_PUBLIC_KEY={pub}")
    print(f"VAPID_PRIVATE_KEY={priv}")
    print("-----------------------------------------------\n")
