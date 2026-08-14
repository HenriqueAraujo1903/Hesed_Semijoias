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
import java.util.HashMap;
import java.util.Map;

@Service
public class CsvImportService {

    private final ProductService productService;

    public CsvImportService(ProductService productService) {
        this.productService = productService;
    }

    public Map<String, Object> importFromUrl(String sheetUrl) {
        if (!sheetUrl.contains("docs.google.com/spreadsheets")) {
            throw new RuntimeException("URL inválida. Use a URL de publicação CSV da Google Sheets.");
        }

        String csvUrl = sheetUrl.contains("output=csv")
                ? sheetUrl
                : sheetUrl.replaceAll("/pub.*", "/pub?output=csv");

        String csvText;
        try {
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(csvUrl))
                    .GET()
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new RuntimeException("HTTP " + response.statusCode());
            }
            csvText = response.body();
        } catch (Exception e) {
            throw new RuntimeException("Não foi possível buscar a planilha: " + e.getMessage());
        }

        return parseCsvAndUpsert(csvText);
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

                    productService.upsertBySku(req);

                    // Count as created or updated based on existence
                    if (productService.findAll(null, null, sku).isEmpty()) {
                        created++;
                    } else {
                        updated++;
                    }
                    // Simplification: count all as "updated" since upsert handles both
                    updated++;
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
