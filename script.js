fetch("data.json")
.then(res => res.json())
.then(data => {

    const results = document.getElementById("results");
    const featuredContainer = document.getElementById("featuredContainer");
    const tagContainer = document.getElementById("tagContainer");
    const categoryContainer = document.getElementById("categoryContainer");
    const searchInput = document.getElementById("search");
    const clearBtn = document.getElementById("clearFilters");
    const typeFilter = document.getElementById("typeFilter");

    let activeTags = [];
    let activeCategories = [];

    // Stats
    document.getElementById("docCount").textContent = data.length;

    const categories = [...new Set(data.flatMap(item => item.categories))];
    const tags = [...new Set(data.flatMap(item => item.tags))];
    const types = [...new Set(data.map(item => item.type))];

    document.getElementById("categoryCount").textContent = categories.length;
    document.getElementById("tagCount").textContent = tags.length;

    // Populate type dropdown
    types.forEach(type => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = type;
        typeFilter.appendChild(option);
    });

    function createChips(list, container, activeArray) {
        list.forEach(item => {
            const chip = document.createElement("div");
            chip.classList.add("tag-chip");
            chip.textContent = item;

            chip.addEventListener("click", () => {
                chip.classList.toggle("active");

                if (activeArray.includes(item)) {
                    activeArray.splice(activeArray.indexOf(item), 1);
                } else {
                    activeArray.push(item);
                }
                filterData();
            });

            container.appendChild(chip);
        });
    }

    createChips(categories, categoryContainer, activeCategories);
    createChips(tags, tagContainer, activeTags);

    function renderCard(item) {
        return `
            <div class="card">
                <h3>${item.title}</h3>
                <p>${item.description}</p>
                <div>${item.categories.map(c => `<span class="badge">${c}</span>`).join("")}</div>
                <div>${item.tags.map(t => `<span class="badge">${t}</span>`).join("")}</div>
                <a href="${item.url}" target="_blank">Open Resource</a>
            </div>
        `;
    }

    function display(items, container) {
        container.innerHTML = items.map(renderCard).join("");
    }

    function filterData() {

        const searchValue = searchInput.value.toLowerCase();
        const selectedType = typeFilter.value;

        const filtered = data.filter(item => {

            const matchesSearch =
                item.title.toLowerCase().includes(searchValue) ||
                item.description.toLowerCase().includes(searchValue) ||
                item.categories.join(" ").toLowerCase().includes(searchValue) ||
                item.tags.join(" ").toLowerCase().includes(searchValue);

            const matchesTags =
                activeTags.length === 0 ||
                activeTags.every(tag => item.tags.includes(tag));

            const matchesCategories =
                activeCategories.length === 0 ||
                activeCategories.every(cat => item.categories.includes(cat));

            const matchesType =
                selectedType === "" || item.type === selectedType;

            return matchesSearch && matchesTags && matchesCategories && matchesType;
        });

        display(filtered, results);
    }

    searchInput.addEventListener("keyup", filterData);
    typeFilter.addEventListener("change", filterData);

    clearBtn.addEventListener("click", () => {
        activeTags = [];
        activeCategories = [];
        document.querySelectorAll(".tag-chip").forEach(chip => chip.classList.remove("active"));
        searchInput.value = "";
        typeFilter.value = "";
        display(data, results);
    });

    // Featured section
    const featured = data.filter(item => item.featured);
    display(featured, featuredContainer);

    display(data, results);
});