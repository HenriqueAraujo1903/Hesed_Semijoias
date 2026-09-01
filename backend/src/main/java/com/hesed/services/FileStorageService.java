package com.hesed.services;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
public class FileStorageService {

    private static final long MAX_SIZE = 5 * 1024 * 1024; // 5MB

    private final Path uploadPath;
    private final String baseUrl;

    public FileStorageService(@Value("${app.upload.dir}") String uploadDir,
                              @Value("${app.upload.base-url}") String baseUrl) {
        this.uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
        this.baseUrl = baseUrl;

        try {
            Files.createDirectories(this.uploadPath);
        } catch (IOException e) {
            throw new RuntimeException("Não foi possível criar o diretório de uploads.", e);
        }
    }

    /**
     * Tipo de imagem determinado pelo CONTEÚDO REAL (magic bytes), não pelo
     * Content-Type informado pelo cliente (que é forjável). A extensão salva
     * é derivada do tipo detectado — nunca da extensão enviada pelo cliente.
     */
    private enum ImageType {
        JPEG(".jpg"), PNG(".png"), WEBP(".webp");
        final String ext;
        ImageType(String ext) { this.ext = ext; }
    }

    public String store(MultipartFile file) {
        if (file.isEmpty()) {
            throw new RuntimeException("Nenhum arquivo enviado.");
        }
        if (file.getSize() > MAX_SIZE) {
            throw new RuntimeException("Arquivo muito grande. Máximo 5 MB.");
        }

        byte[] header;
        try {
            header = readHeader(file);
        } catch (IOException e) {
            throw new RuntimeException("Erro ao ler o arquivo.");
        }

        ImageType type = detectImageType(header);
        if (type == null) {
            throw new RuntimeException("Arquivo inválido. Envie uma imagem JPG, PNG ou WebP real.");
        }

        // Nome 100% controlado pelo servidor: UUID + extensão do tipo detectado.
        // A extensão do cliente é ignorada (evita salvar .html/.svg disfarçado).
        String fileName = UUID.randomUUID() + type.ext;
        Path targetPath = uploadPath.resolve(fileName).normalize();

        // Defesa extra: garante que o alvo permanece dentro do diretório de uploads
        if (!targetPath.startsWith(uploadPath)) {
            throw new RuntimeException("Caminho de destino inválido.");
        }

        try {
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new RuntimeException("Erro ao salvar o arquivo.");
        }

        return baseUrl + "/" + fileName;
    }

    /** Lê os primeiros bytes do arquivo para inspeção de magic bytes. */
    private byte[] readHeader(MultipartFile file) throws IOException {
        try (var in = file.getInputStream()) {
            byte[] buf = new byte[16];
            int read = in.readNBytes(buf, 0, 16);
            if (read < buf.length) {
                byte[] trimmed = new byte[Math.max(read, 0)];
                System.arraycopy(buf, 0, trimmed, 0, Math.max(read, 0));
                return trimmed;
            }
            return buf;
        }
    }

    /**
     * Detecta o tipo de imagem pelos magic bytes:
     *  - JPEG: FF D8 FF
     *  - PNG : 89 50 4E 47 0D 0A 1A 0A
     *  - WebP: "RIFF" .... "WEBP"
     * Retorna null se não corresponder a nenhum formato de imagem suportado.
     */
    private ImageType detectImageType(byte[] b) {
        if (b == null) return null;

        if (b.length >= 3
                && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return ImageType.JPEG;
        }
        if (b.length >= 8
                && (b[0] & 0xFF) == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47
                && b[4] == 0x0D && b[5] == 0x0A && b[6] == 0x1A && b[7] == 0x0A) {
            return ImageType.PNG;
        }
        if (b.length >= 12
                && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') {
            return ImageType.WEBP;
        }
        return null;
    }
}
