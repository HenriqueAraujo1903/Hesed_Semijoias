package com.hesed.services;

import com.hesed.dto.ProductRequest;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Service;

import java.io.InputStreamReader;
import java.io.Reader;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

@Service
public class CsvImportService {

    /**
     * Hosts permitidos para importação. Validação por igualdade EXATA do host
     * (não substring), evitando SSRF via URLs como
     * http://interno/docs.google.com/spreadsheets ou uso de fragment/query.
     */
    private static final Set<String> ALLOWED_HOSTS = Set.of("docs.google.com");

    private final ProductService productService;

    public CsvImportService(ProductService productService) {
        this.productService = productService;
    }

    public Map<String, Object> importFromUrl(String sheetUrl) {
        URI uri = validateAndNormalize(sheetUrl);

        String csvText;
        try {
            HttpClient client = HttpClient.newBuilder()
                    .followRedirects(HttpClient.Redirect.NEVER) // impede bypass via redirect para host interno
                    .connectTimeout(Duration.ofSeconds(10))
                    .build();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(uri)
                    .timeout(Duration.ofSeconds(20))
                    .GET()
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                // Mensagem genérica — não vaza detalhe da resposta interna
                throw new RuntimeException("Não foi possível ler a planilha. Verifique se ela está publicada como CSV.");
            }
            csvText = response.body();
        } catch (RuntimeException re) {
            throw re;
        } catch (Exception e) {
            // Não propaga a mensagem original (evita oráculo de SSRF)
            throw new RuntimeException("Não foi possível buscar a planilha. Verifique a URL de publicação.");
        }

        return parseCsvAndUpsert(csvText);
    }

    /**
     * Valida a URL da planilha contra SSRF: exige HTTPS, host EXATAMENTE em
     * ALLOWED_HOSTS, e normaliza para o export CSV. Rejeita qualquer outra coisa.
     */
    private URI validateAndNormalize(String sheetUrl) {
        if (sheetUrl == null || sheetUrl.isBlank()) {
            throw new RuntimeException("URL obrigatória.");
        }
        URI uri;
        try {
            uri = URI.create(sheetUrl.trim());
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("URL inválida.");
        }

        String scheme = uri.getScheme();
        String host = uri.getHost();

        if (scheme == null || !scheme.equalsIgnoreCase("https")) {
            throw new RuntimeException("A URL deve usar HTTPS.");
        }
        if (host == null || !ALLOWED_HOSTS.contains(host.toLowerCase())) {
            throw new RuntimeException("URL inválida. Use a URL de publicação da Google Sheets (docs.google.com).");
        }
        // Exige que seja de fato uma planilha publicada
        String path = uri.getPath() != null ? uri.getPath() : "";
        if (!path.startsWith("/spreadsheets/")) {
            throw new RuntimeException("URL inválida. Use a URL de publicação CSV da Google Sheets.");
        }

        // Normaliza para export CSV, preservando host/path validados
        String full = uri.toString();
        String csvUrl = full.contains("output=csv") ? full : full.replaceAll("/pub.*", "/pub?output=csv");
        return URI.create(csvUrl);
    }

    public Map<String, Object> importFromCsvContent(String csvContent) {
        return parseCsvAndUpsert(csvContent);
    }

    private Map<String, Object> parseCsvAndUpsert(String csvText) {
        int created = 0;
        int updated = 0;
        int errors = 0;

        try {
            Reader reader = new InputStreamReader(
                    new java.io.ByteArrayInputStream(csvText.getBytes(StandardCharsets.UTF_8)),
                    StandardCharsets.UTF_8);

            CSVParser parser = CSVFormat.DEFAULT
                    .builder()
                    .setHeader()
                    .setSkipHeaderRecord(true)
                    .setIgnoreHeaderCase(true)
                    .setTrim(true)
                    .build()
                    .parse(reader);

            Map<String, String> headerMap = buildHeaderMap(parser.getHeaderNames().toArray(new String[0]));

            for (CSVRecord record : parser) {
                String sku = getField(record, headerMap, "sku");
                String name = getField(record, headerMap, "name");

                if (sku == null || sku.isBlank() || name == null || name.isBlank()) continue;

                try {
                    ProductRequest req = new ProductRequest();
                    req.setSku(sku.trim());
                    req.setName(name.trim());
                    req.setCategory(parseCategory(getField(record, headerMap, "category")));
                    req.setSalePrice(parsePrice(getField(record, headerMap, "salePrice")));
                    req.setCostPrice(parsePrice(getField(record, headerMap, "costPrice")));
                    req.setStockStatus(parseStockStatus(getField(record, headerMap, "stockStatus")));

                    // Existência ANTES do upsert define se foi criação ou atualização
                    boolean existedBefore = productService.existsAnyBySearch(sku);
                    productService.upsertBySku(req);
                    if (existedBefore) {
                        updated++;
                    } else {
                        created++;
                    }
                } catch (Exception e) {
                    errors++;
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("Erro ao processar CSV: " + e.getMessage());
        }

        Map<String, Object> result = new HashMap<>();
        result.put("created", created);
        result.put("updated", updated);
        result.put("errors", errors);
        return result;
    }

    private Map<String, String> buildHeaderMap(String[] headers) {
        Map<String, String> map = new HashMap<>();
        for (String h : headers) {
            String lower = h.toLowerCase();
            if (lower.contains("codigo") || lower.contains("sku") || lower.contains("cód")) {
                map.put("sku", h);
            } else if (lower.contains("descri") || lower.contains("nome") || lower.contains("produto")) {
                map.put("name", h);
            } else if (lower.contains("categoria") || lower.contains("category")) {
                map.put("category", h);
            } else if (lower.contains("venda") || lower.contains("sale")) {
                map.put("salePrice", h);
            } else if (lower.contains("custo") || lower.contains("cost")) {
                map.put("costPrice", h);
            } else if (lower.contains("status") || lower.contains("estoque")) {
                map.put("stockStatus", h);
            }
        }
        return map;
    }

    private String getField(CSVRecord record, Map<String, String> headerMap, String key) {
        String header = headerMap.get(key);
        if (header == null) return null;
        try {
            return record.get(header);
        } catch (Exception e) {
            return null;
        }
    }

    private BigDecimal parsePrice(String raw) {
        if (raw == null || raw.isBlank()) return BigDecimal.ZERO;
        String cleaned = raw.replaceAll("R\\$\\s*", "")
                .replaceAll("\\.", "")
                .replace(",", ".")
                .trim();
        try {
            return new BigDecimal(cleaned);
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }

    private String parseStockStatus(String raw) {
        if (raw == null || raw.isBlank()) return "DISPONIVEL";
        String lower = raw.trim().toLowerCase();
        if (lower.equals("esgotado")) return "ESGOTADO";
        if (lower.equals("baixo")) return "BAIXO";
        return "DISPONIVEL";
    }

    private String parseCategory(String raw) {
        if (raw == null || raw.isBlank()) return "Brinco";
        String lower = raw.trim().toLowerCase();
        return switch (lower) {
            case "brinco" -> "Brinco";
            case "brinco / trio", "brinco/trio", "trio" -> "Brinco / Trio";
            case "conjunto" -> "Conjunto";
            case "corrente" -> "Corrente";
            case "gargantilha" -> "Gargantilha";
            default -> raw.trim();
        };
    }
}
