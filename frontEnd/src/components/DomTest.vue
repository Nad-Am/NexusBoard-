<template>
    <div class="dom-test">
        <h1>DomTest</h1>
        <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, quod.</p>
        <p>Count: {{ count }}</p>
        <button @click="handleClick">Click Me</button>
    </div>
</template>
<script setup>
import { ref } from "vue";
const count = ref(0);
const handleClick = () => {
    count.value++;
    console.log("[DomTest] Clicked. New count:", count.value);
};
</script>
<style scoped>
.dom-test {
    width: 100%;
    height: 100%;
    background-color: #984444;
    overflow: hidden; /* Prevent spillover */
}
</style>