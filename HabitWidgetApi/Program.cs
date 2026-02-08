using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using System.Globalization;

var builder = WebApplication.CreateBuilder(args);

//CORS for React/Electron
builder.Services.AddCors(o =>
{
    o.AddDefaultPolicy(p => p.AllowAnyOrigin()
                            .AllowAnyHeader()
                            .AllowAnyMethod());
});

//Response Cached for 60 seconds to avoid hitting Notion API rate limits and improve performance
builder.Services.AddMemoryCache();

//HttoClient for Notion API
//URL base set 
//Authorication header
//Notion-Version header (required by Notion API)

builder.Services.AddHttpClient("notion", (sp, client) =>
{
    var cfg = sp.GetRequiredService<IConfiguration>();
    var token = cfg["Notion:Token"]
    ?? Environment.GetEnvironmentVariable("NOTION_TOKEN");


    //Validation for token presence; if missing, throw an exception 
    if (string.IsNullOrWhiteSpace(token))
        throw new Exception("Missing Notion:Token in appsettings.Development.json");

    client.BaseAddress = new Uri("https://api.notion.com/v1/");

    client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

    //Notion API versioning (Required for Notion API)
    client.DefaultRequestHeaders.Add("Notion-Version", "2022-06-28");
});

var app = builder.Build();
app.UseCors();

//ENDPOINTS

// Simple health check endpoint; confirms that backend working
app.MapGet("/api/health", () => Results.Ok(new { ok = true }));

//HEATMAP ENDPOINT
// Returns: [{ day: "YYYY-MM-DD", value: number }, ...]
app.MapGet("/api/heatmap", async (
    IConfiguration cfg,
    IHttpClientFactory httpFactory,
    IMemoryCache cache) =>
{

    //cache hit check: if we have a cached value for "heatmap", return it immediately without hitting Notion API
    if (cache.TryGetValue("heatmap", out List<object>? cached) && cached is not null)
        return Results.Ok(cached);

    //Read database ID from configuration; if missing, return an error response
    var dbId = cfg["Notion:DatabaseId"]
        ?? Environment.GetEnvironmentVariable("NOTION_DATABASE_ID");

        
    if (string.IsNullOrWhiteSpace(dbId))
        return Results.Problem("Missing Notion:DatabaseId in appsettings.Development.json");

    //Read Notion Date property (which could be empty)
    var datePropName = cfg["Notion:DateProperty"] ?? "Date"; // can be "" if you want title parsing


    //Http Client for Notion API
    var http = httpFactory.CreateClient("notion");

    //Pages returned from Notion API (we will aggregate across pagination)
    var pages = new List<JsonElement>();
    string? cursor = null;


    //Pagination Loop: keep querying Notion API until we have all pages of results from the database query
    while (true)
    {
        //Request body for Notion API query; includes page_size and optionally start_cursor for pagination
        object bodyObj;
        if (cursor == null)
        {
            bodyObj = new { page_size = 100 };
    }
    else
    {
        bodyObj = new { page_size = 100, start_cursor = cursor };
    }

        var bodyJson = JsonSerializer.Serialize(bodyObj);
        using var content = new StringContent(bodyJson, Encoding.UTF8, "application/json");

        //POST /databases/{dbId}/query to Notion API
        using var resp = await http.PostAsync($"databases/{dbId}/query", content);
        var respText = await resp.Content.ReadAsStringAsync();

        if (!resp.IsSuccessStatusCode)
            return Results.Problem($"Notion API error: {(int)resp.StatusCode} {resp.ReasonPhrase}\n{respText}");

        //Parse JSON response; extract "results" array and pagination info (has_more, next_cursor)
        using var doc = JsonDocument.Parse(respText);
        var root = doc.RootElement;

        // Append results to our pages list
        foreach (var item in root.GetProperty("results").EnumerateArray())
        pages.Add(item.Clone());

        //Check pagination info: if has_more is true, we need to do another request with the next_cursor; if false, we are done
        var hasMore = root.GetProperty("has_more").GetBoolean();
        cursor = root.TryGetProperty("next_cursor", out var nc) && nc.ValueKind != JsonValueKind.Null
            ? nc.GetString()
            : null;

        if (!hasMore) break;
    }

    //Aggregate: DateOnly -> checked count
    var counts = new Dictionary<DateOnly, int>();

    foreach (var page in pages)
    {
        //Figure out the date for this row (otherwise parse from title)
        var date = TryGetDateFromProperty(page, datePropName)
                   ?? TryParseDateFromTitle(page);

        if (date is null) continue;

        // 2) Count checked checkbox properties (each checkbox column is a habit)
        int checkedHabits = 0;

        //Counting the checked habits 
        if (page.TryGetProperty("properties", out var props) && props.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in props.EnumerateObject())
            {
                var propObj = prop.Value;
                if (!propObj.TryGetProperty("type", out var typeEl)) continue;

                var type = typeEl.GetString();
                if (type == "checkbox" &&
                    propObj.TryGetProperty("checkbox", out var cbEl) &&
                    cbEl.ValueKind == JsonValueKind.True)
                {
                    checkedHabits++;
                }
            }
        }

        counts[date.Value] = checkedHabits;
    }

    //Convert counts ->  [{ day: "YYYY-MM-DD", value: number }, ...] for frontend; also cache the result for 60 seconds to improve performance and avoid Notion API rate limits
    var result = counts
        .OrderBy(kv => kv.Key)
        .Select(kv => (object)new
        {
            day = kv.Key.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            value = kv.Value
        })
        .ToList();

    cache.Set("heatmap", result, TimeSpan.FromSeconds(60));
    return Results.Ok(result);
});

app.Run("http://localhost:5050");

// -------- helper functions --------

static DateOnly? TryGetDateFromProperty(JsonElement page, string datePropName)
{
    if (string.IsNullOrWhiteSpace(datePropName)) return null;

    if (!page.TryGetProperty("properties", out var props) || props.ValueKind != JsonValueKind.Object)
        return null;

    if (!props.TryGetProperty(datePropName, out var dateProp) || dateProp.ValueKind != JsonValueKind.Object)
        return null;

    // Expect: { "type": "date", "date": { "start": "2023-01-01" } }
    if (!dateProp.TryGetProperty("type", out var typeEl) || typeEl.GetString() != "date")
        return null;

    if (!dateProp.TryGetProperty("date", out var dateObj) || dateObj.ValueKind != JsonValueKind.Object)
        return null;

    if (!dateObj.TryGetProperty("start", out var startEl) || startEl.ValueKind != JsonValueKind.String)
        return null;

    var s = startEl.GetString();
    if (DateOnly.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.None, out var d))
        return d;

    // Sometimes includes time; try DateTime parse
    if (DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var dt))
        return DateOnly.FromDateTime(dt);

    return null;
}

static DateOnly? TryParseDateFromTitle(JsonElement page)
{
    // Find the database title property dynamically: it’s the property whose type == "title"
    if (!page.TryGetProperty("properties", out var props) || props.ValueKind != JsonValueKind.Object)
        return null;

    foreach (var prop in props.EnumerateObject())
    {
        var obj = prop.Value;
        if (!obj.TryGetProperty("type", out var typeEl)) continue;
        if (typeEl.GetString() != "title") continue;

        if (!obj.TryGetProperty("title", out var titleArr) || titleArr.ValueKind != JsonValueKind.Array)
            continue;

        var sb = new StringBuilder();
        foreach (var t in titleArr.EnumerateArray())
        {
            if (t.TryGetProperty("plain_text", out var pt) && pt.ValueKind == JsonValueKind.String)
                sb.Append(pt.GetString());
        }

        var text = sb.ToString().Trim();
        text = text.TrimStart('@').Trim();

        if (DateTime.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var dt))
            return DateOnly.FromDateTime(dt);

        if (DateTime.TryParse(text, out dt))
            return DateOnly.FromDateTime(dt);

        return null;
    }

    return null;
}
